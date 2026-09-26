class RubricWorkbookParser {
	static async parse(fileName, buffer) {
		const normalizedFileName = fileName.toLowerCase();

		if (normalizedFileName.endsWith('.csv')) return this.parseCsv(buffer);
		if (normalizedFileName.endsWith('.xlsx')) return this.parseXlsx(buffer);
		throw new Error('Unsupported file format. Use .csv or .xlsx.');
	}

	static parseXlsx(buffer) {
		let files;
		try {
			files = fflate.unzipSync(new Uint8Array(buffer), {
				filter: file => file.name === 'xl/workbook.xml' || file.name === 'xl/_rels/workbook.xml.rels' ||
					file.name === 'xl/sharedStrings.xml' || /^xl\/worksheets\/[^/]+\.xml$/.test(file.name)
			});
		} catch {
			throw new Error('The Excel file is not a readable .xlsx workbook.');
		}

		const workbook = this.readXml(files, 'xl/workbook.xml');
		const firstSheet = workbook.getElementsByTagNameNS('*', 'sheet')[0];
		if (!firstSheet) throw new Error('The Excel workbook does not contain a worksheet.');
		const relationshipId = firstSheet.getAttribute('r:id') || firstSheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
		const relationships = this.readXml(files, 'xl/_rels/workbook.xml.rels');
		const relationship = Array.from(relationships.getElementsByTagNameNS('*', 'Relationship'))
			.find(item => item.getAttribute('Id') === relationshipId);
		if (!relationship || !relationship.getAttribute('Type')?.endsWith('/worksheet')) {
			throw new Error('The first Excel worksheet cannot be found.');
		}

		const target = relationship.getAttribute('Target');
		const sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
		const normalizedPath = sheetPath.split('/').reduce((parts, part) => {
			if (part === '..') parts.pop();
			else if (part !== '.') parts.push(part);
			return parts;
		}, []).join('/');
		if (!normalizedPath.startsWith('xl/worksheets/')) throw new Error('The first Excel worksheet has an invalid path.');

		const sharedStrings = files['xl/sharedStrings.xml']
			? Array.from(this.readXml(files, 'xl/sharedStrings.xml').getElementsByTagNameNS('*', 'si'), item => this.readText(item))
			: [];
		const worksheet = this.readXml(files, normalizedPath);
		const sheet = {};
		for (const cell of worksheet.getElementsByTagNameNS('*', 'c')) {
			const address = cell.getAttribute('r');
			if (!/^[A-Z]+[1-9]\d*$/.test(address || '')) continue;
			const type = cell.getAttribute('t');
			const rawValue = cell.getElementsByTagNameNS('*', 'v')[0]?.textContent;
			let value;
			if (type === 'inlineStr') value = this.readText(cell.getElementsByTagNameNS('*', 'is')[0]);
			else if (type === 's') value = sharedStrings[Number(rawValue)];
			else if (type === 'str') value = rawValue;
			else if (type === 'e') throw new Error(`The Excel worksheet contains an error in ${address}.`);
			else if (rawValue !== undefined && rawValue !== '') value = type === 'b' ? rawValue : Number(rawValue);
			if (value !== undefined && value !== '' && (typeof value !== 'number' || Number.isFinite(value))) {
				sheet[address] = { v: value };
			}
		}
		return sheet;
	}

	static readXml(files, path) {
		if (!files[path]) throw new Error(`The Excel workbook is missing ${path}.`);
		const xml = new TextDecoder('utf-8', { fatal: true }).decode(files[path]);
		const document = new DOMParser().parseFromString(xml, 'application/xml');
		if (document.getElementsByTagName('parsererror').length) throw new Error(`The Excel workbook contains invalid XML in ${path}.`);
		return document;
	}

	static readText(element) {
		if (!element) return '';
		return Array.from(element.getElementsByTagNameNS('*', 't'), item => item.textContent).join('');
	}

	static parseCsv(buffer) {
		const text = this.decodeCsv(buffer);
		const delimiter = this.detectDelimiter(text);
		const rows = this.parseDelimitedRows(text, delimiter);
		return this.buildSheet(rows);
	}

	static decodeCsv(buffer) {
		try {
			return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
		} catch {
			return new TextDecoder('windows-1252').decode(buffer);
		}
	}

	static detectDelimiter(text) {
		const candidates = [',', ';', '\t'];
		const sampleLines = text.split(/\r?\n/).filter(line => line.trim().length > 0).slice(0, 5);
		let bestDelimiter = ',';
		let bestScore = -1;

		for (const delimiter of candidates) {
			const score = sampleLines.reduce((total, line) => total + this.countDelimitedFields(line, delimiter), 0);
			if (score > bestScore) {
				bestScore = score;
				bestDelimiter = delimiter;
			}
		}

		return bestDelimiter;
	}

	static countDelimitedFields(line, delimiter) {
		let count = 1;
		let insideQuotes = false;

		for (let index = 0; index < line.length; index++) {
			const char = line[index];
			if (char === '"') {
				if (insideQuotes && line[index + 1] === '"') {
					index++;
				} else {
					insideQuotes = !insideQuotes;
				}
				continue;
			}

			if (!insideQuotes && char === delimiter) {
				count++;
			}
		}

		return count;
	}

	static parseDelimitedRows(text, delimiter) {
		const rows = [];
		let row = [];
		let value = '';
		let insideQuotes = false;

		for (let index = 0; index < text.length; index++) {
			const char = text[index];
			const nextChar = text[index + 1];

			if (char === '"') {
				if (insideQuotes && nextChar === '"') {
					value += '"';
					index++;
				} else {
					insideQuotes = !insideQuotes;
				}
				continue;
			}

			if (!insideQuotes && char === delimiter) {
				row.push(value);
				value = '';
				continue;
			}

			if (!insideQuotes && (char === '\n' || char === '\r')) {
				if (char === '\r' && nextChar === '\n') {
					index++;
				}

				row.push(value);
				rows.push(row);
				row = [];
				value = '';
				continue;
			}

			value += char;
		}

		if (value.length > 0 || row.length > 0) {
			row.push(value);
			rows.push(row);
		}

		return rows;
	}

	static buildSheet(rows) {
		const sheet = {};

		for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
			for (let columnIndex = 0; columnIndex < rows[rowIndex].length; columnIndex++) {
				const value = rows[rowIndex][columnIndex];
				if (value === '') continue;

				const address = `${this.columnIndexToName(columnIndex)}${rowIndex + 1}`;
				sheet[address] = { v: this.parseScalar(value) };
			}
		}

		return sheet;
	}

	static parseScalar(value) {
		const trimmedValue = value.trim();
		if (trimmedValue === '') return '';

		const numericValue = Number(trimmedValue);
		return Number.isFinite(numericValue) ? numericValue : trimmedValue;
	}

	static columnIndexToName(columnIndex) {
		let currentIndex = columnIndex + 1;
		let columnName = '';

		while (currentIndex > 0) {
			const remainder = (currentIndex - 1) % 26;
			columnName = String.fromCharCode(65 + remainder) + columnName;
			currentIndex = Math.floor((currentIndex - 1) / 26);
		}

		return columnName;
	}
}

window.RubricWorkbookParser = RubricWorkbookParser;
