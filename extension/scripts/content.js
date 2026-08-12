
class RubricImporter {
	constructor() {
		this.table = document.getElementById('rubric-criteria');
		this.tbody = this.table ? this.table.lastElementChild : null;
		this.addCriterionButton = document.getElementById('rubric-criteria-addcriterion');
		this.rubric = document.getElementById('fitem_id_rubric');
		this.i18n = new RubricImporterI18n();

		if (this.rubric) {
			this.init();
		}
	}

	async init() {
		await this.i18n.init();
		this.injectToastContainer();
		this.rubric.prepend(this.createDropZone());
	}

	t(name, substitutions = []) {
		return this.i18n.getMessage(name, substitutions);
	}

	injectToastContainer() {
		if (!document.getElementById('rubric-importer-toast-container')) {
			const container = document.createElement('div');
			container.id = 'rubric-importer-toast-container';
			document.body.appendChild(container);
		}
	}

	showToast(message, type = 'info') {
		const container = document.getElementById('rubric-importer-toast-container');
		const toast = document.createElement('div');
		toast.className = `rubric-importer-toast ${type}`;
		toast.textContent = message;

		container.appendChild(toast);

		// Trigger reflow
		toast.offsetHeight;

		toast.classList.add('show');

		setTimeout(() => {
			toast.classList.remove('show');
			setTimeout(() => {
				toast.remove();
			}, 300);
		}, 3000);
	}

	createDropZone() {
		const wrapper = document.createElement('div');
		wrapper.classList.add('form-group'); // Moodle form group class

		const dropZone = document.createElement('div');
		dropZone.classList.add('rubric-importer-dropzone');
		dropZone.setAttribute('role', 'button');
		dropZone.setAttribute('tabindex', '0');
		dropZone.setAttribute('aria-label', this.t('dropZoneTitle'));
		dropZone.title = this.t('dropZoneTitle');

		const icon = document.createElement('span');
		icon.classList.add('icon');
		icon.textContent = 'MoodlIA Rubrics';

		const description = document.createElement('p');
		const action = document.createElement('strong');
		action.textContent = this.t('dropZoneStrong');
		description.append(action, document.createTextNode(this.t('dropZoneText')));

		dropZone.append(icon, description);

		// Click to Select
		dropZone.addEventListener('click', (e) => this.onDropZoneClick(e));
		dropZone.addEventListener('keydown', (e) => this.onDropZoneKeyDown(e));

		// Drag and Drop Events
		dropZone.addEventListener('dragover', (e) => {
			e.preventDefault();
			e.stopPropagation();
			dropZone.classList.add('dragover');
		});

		dropZone.addEventListener('dragleave', (e) => {
			e.preventDefault();
			e.stopPropagation();
			dropZone.classList.remove('dragover');
		});

		dropZone.addEventListener('drop', (e) => this.onDrop(e, dropZone));

		wrapper.append(dropZone);
		return wrapper;
	}

	onDropZoneKeyDown(e) {
		if (e.key === 'Enter' || e.key === ' ') {
			this.onDropZoneClick(e);
		}
	}

	selectFile(contentType, multiple = false) {
		return new Promise(resolve => {
			const input = document.createElement('input');
			input.type = 'file';
			input.multiple = multiple;
			input.accept = contentType;

			input.addEventListener('change', () => {
				const files = Array.from(input.files);
				if (multiple) {
					resolve(files);
				} else {
					resolve(files[0]);
				}
			});

			input.click();
		});
	}

	getNextKey(key) {
		if (key === 'Z' || key === 'z') {
			return String.fromCharCode(key.charCodeAt() - 25) + String.fromCharCode(key.charCodeAt() - 25);
		} else {
			const lastChar = key.slice(-1);
			const sub = key.slice(0, -1);
			if (lastChar === 'Z' || lastChar === 'z') {
				return this.getNextKey(sub) + String.fromCharCode(lastChar.charCodeAt() - 25);
			} else {
				return sub + String.fromCharCode(lastChar.charCodeAt() + 1);
			}
		}
	}

	async waitForElement(selector, parent = document, timeout = 2000) {
		const start = Date.now();
		while (Date.now() - start < timeout) {
			const element = parent.querySelector(selector);
			if (element) return element;
			await new Promise(r => requestAnimationFrame(r));
		}
		throw new Error(`Timeout waiting for element: ${selector}`);
	}

	async newCriterion() {
		this.addCriterionButton.click();
		await new Promise(r => setTimeout(r, 100));
	}

	async modifyCriterion(criterionIndex, name) {
		try {
			const tr = this.tbody.children[criterionIndex];
			if (!tr) throw new Error(`Criterion row ${criterionIndex} not found`);

			const descriptionCell = tr.querySelector('.description');
			if (!descriptionCell) throw new Error(`Description cell for criterion ${criterionIndex} not found`);

			let textarea = descriptionCell.querySelector('textarea');

			if (!textarea) {
				if (descriptionCell.firstElementChild) {
					descriptionCell.firstElementChild.click();
				} else {
					descriptionCell.click();
				}
				textarea = await this.waitForElement('textarea', descriptionCell);
			}

			textarea.value = name;
			textarea.dispatchEvent(new Event('input', { bubbles: true }));
			textarea.dispatchEvent(new Event('change', { bubbles: true }));
			textarea.blur();

		} catch (error) {
			console.error('Error modifying criterion:', error);
			throw error;
		}
	}

	async newLevelInCriterion(criterionIndex) {
		const tr = this.tbody.children[criterionIndex];
		const addLevelButton = tr.querySelector('.addlevel input') || tr.querySelector('.addlevel button') || tr.querySelector('.addlevel');
		if (addLevelButton) {
			addLevelButton.click();
			await new Promise(r => setTimeout(r, 100));
		} else {
			const btn = tr.getElementsByClassName('addlevel')[0]?.firstElementChild;
			if (btn) btn.click();
			await new Promise(r => setTimeout(r, 100));
		}
	}

	async modifyLevelInCriterion(criterionIndex, levelIndex, description, grade) {
		try {
			const tr = this.tbody.children[criterionIndex];
			const levelsTable = tr.querySelector('table');
			const tbodyLevels = levelsTable.querySelector('tbody');

			let levelChild = tbodyLevels.rows[0].cells[levelIndex];
			if (!levelChild) {
				await new Promise(r => setTimeout(r, 200));
				levelChild = tbodyLevels.rows[0].cells[levelIndex];
			}

			if (!levelChild) throw new Error(`Level cell ${levelIndex} in criterion ${criterionIndex} not found`);

			levelChild.click();

			const levelTextarea = await this.waitForElement('.definition textarea', levelChild);
			levelTextarea.value = description;
			levelTextarea.dispatchEvent(new Event('input', { bubbles: true }));
			levelTextarea.dispatchEvent(new Event('change', { bubbles: true }));


			const gradeInput = await this.waitForElement('.score input', levelChild);
			gradeInput.value = grade;
			gradeInput.dispatchEvent(new Event('input', { bubbles: true }));
			gradeInput.dispatchEvent(new Event('change', { bubbles: true }));

			gradeInput.blur();
		} catch (e) {
			console.error(`Error modifying level ${levelIndex} of criterion ${criterionIndex}`, e);
			throw e;
		}
	}

	async processWorkbook(data, fileName) {
		const offset = 0;

		try {
			const sheet = await RubricWorkbookParser.parse(fileName, data);
			if (!sheet) throw new Error('No sheet found in spreadsheet file');

			let row = 1 + offset;
			let criterionCell = 'A' + row;

			let criterionIndex = 0;

			this.showToast(this.t('startingImport'), 'info');

			while (sheet[criterionCell]) {
				const criterionName = sheet[criterionCell].v;
				let levelIndex = 0;

				if (criterionIndex >= this.tbody.children.length - 1) {
					if (!this.tbody.children[criterionIndex]) {
						await this.newCriterion();
					}
				}

				await this.modifyCriterion(criterionIndex, criterionName);

				let levelColumn = 'B';
				let levelCell = levelColumn + row;
				let gradeCell = levelColumn + (row + 1);

				while (sheet[levelCell]) {
					const levelDesc = sheet[levelCell].v;
					const levelGrade = sheet[gradeCell] ? sheet[gradeCell].v : 0;

					const tr = this.tbody.children[criterionIndex];
					// Use robust selector to count only actual levels, excluding 'addlevel' button
					const currentLevels = tr.querySelectorAll('table tbody tr td.level');

					if (levelIndex >= currentLevels.length) {
						await this.newLevelInCriterion(criterionIndex);
					}


					await this.modifyLevelInCriterion(criterionIndex, levelIndex, levelDesc, levelGrade);

					levelColumn = this.getNextKey(levelColumn);
					levelCell = levelColumn + row;
					gradeCell = levelColumn + (row + 1);
					levelIndex++;
				}

				// Prune excess levels (Moodle copies default levels from previous criterion)
				const tr = this.tbody.children[criterionIndex];
				let currentLevels = tr.querySelectorAll('table tbody tr td.level');
				while (currentLevels.length > levelIndex) {
					const lastLevel = currentLevels[currentLevels.length - 1];
					const deleteBtn = lastLevel.querySelector('.delete input') || lastLevel.querySelector('.delete button') || lastLevel.querySelector('.delete');

					if (deleteBtn) {
						deleteBtn.click();
						// Wait for DOM update
						await new Promise(r => setTimeout(r, 50));
						// Update list
						currentLevels = tr.querySelectorAll('table tbody tr td.level');
					} else {
						console.warn('Could not find delete button for excess level');
						break;
					}
				}

				row += 2;
				criterionCell = 'A' + row;
				criterionIndex++;

				await new Promise(r => setTimeout(r, 50));
			}

			this.showToast(this.t('importCompleted'), 'success');

		} catch (error) {
			console.error(error);
			this.showToast(this.t('importError', [error.message]), 'error');
		}
	}

	async readFile(file) {
		try {
			const fileContent = await file.arrayBuffer();
			await this.processWorkbook(fileContent, file.name);
		} catch (error) {
			console.error(error);
			this.showToast(this.t('readFileError'), 'error');
		}
	}

	async onDropZoneClick(e) {
		e.preventDefault();
		try {
			const file = await this.selectFile('.csv');
			if (!file) return;
			await this.readFile(file);
		} catch (error) {
			this.showToast(this.t('selectFileError'), 'error');
		}
	}

	onDrop(e, dropZone) {
		e.preventDefault();
		e.stopPropagation();
		dropZone.classList.remove('dragover');

		const files = e.dataTransfer.files;
		if (files.length > 0) {
			const file = files[0];
			if (file.name.endsWith('.csv')) {
				this.readFile(file);
			} else {
				this.showToast(this.t('invalidFileType'), 'error');
			}
		}
	}
}

if (!window.__rubricandoImporterLoaded) {
	window.__rubricandoImporterLoaded = true;
	new RubricImporter();
}
