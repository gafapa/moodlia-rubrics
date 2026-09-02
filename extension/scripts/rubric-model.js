class RubricImportModel {
	static fromSheet(sheet) {
		if (!sheet || typeof sheet !== 'object') {
			throw new Error('The CSV file does not contain a readable rubric.');
		}

		const criteria = [];
		let rowNumber = 1;

		while (this.hasCell(sheet, `A${rowNumber}`)) {
			const criterionName = this.readText(sheet[`A${rowNumber}`]);
			const levels = [];
			let columnIndex = 1;

			if (!criterionName.trim()) {
				throw new Error(`Criterion ${criteria.length + 1} does not have a description.`);
			}

			while (true) {
				const columnName = this.columnIndexToName(columnIndex);
				const definitionCell = sheet[`${columnName}${rowNumber}`];

				if (!this.hasValue(definitionCell)) {
					break;
				}

				const gradeCell = sheet[`${columnName}${rowNumber + 1}`];
				if (!this.hasValue(gradeCell)) {
					throw new Error(`Level ${levels.length + 1} of criterion ${criteria.length + 1} does not have a grade.`);
				}

				levels.push({
					definition: this.readText(definitionCell),
					grade: this.readNumber(gradeCell, criteria.length + 1, levels.length + 1)
				});
				columnIndex++;
			}

			if (levels.length === 0) {
				throw new Error(`Criterion ${criteria.length + 1} does not contain any levels.`);
			}

			criteria.push({ description: criterionName, levels });
			rowNumber += 2;
		}

		if (criteria.length === 0) {
			throw new Error('The CSV file does not contain any rubric criteria.');
		}

		return { criteria };
	}

	static validateWorkshop(model) {
		for (let criterionIndex = 0; criterionIndex < model.criteria.length; criterionIndex++) {
			const criterion = model.criteria[criterionIndex];
			const grades = new Set();

			for (const level of criterion.levels) {
				if (!Number.isInteger(level.grade) || level.grade < 0 || level.grade > 100 || grades.has(level.grade)) {
					return { valid: false, criterionNumber: criterionIndex + 1 };
				}

				grades.add(level.grade);
			}
		}

		return { valid: true };
	}

	static hasCell(sheet, address) {
		return Object.prototype.hasOwnProperty.call(sheet, address);
	}

	static hasValue(cell) {
		return cell && cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== '';
	}

	static readText(cell) {
		return String(cell?.v ?? '');
	}

	static readNumber(cell, criterionNumber, levelNumber) {
		const numericValue = typeof cell.v === 'number' ? cell.v : Number(String(cell.v).trim());

		if (!Number.isFinite(numericValue)) {
			throw new Error(`Level ${levelNumber} of criterion ${criterionNumber} has an invalid grade.`);
		}

		return numericValue;
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

globalThis.RubricImportModel = RubricImportModel;
