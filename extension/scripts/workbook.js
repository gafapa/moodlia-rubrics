class RubricWorkbookParser {
	static async parse(fileName, buffer) {
		const normalizedFileName = fileName.toLowerCase();

		if (!normalizedFileName.endsWith('.csv')) {
			throw new Error('Unsupported file format. Use .csv.');
		}

		return this.parseCsv(buffer);
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
