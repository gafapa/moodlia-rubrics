class RubricImporter {
	constructor() {
		this.i18n = new RubricImporterI18n();
		this.pageType = this.detectPageType();
		this.dropZone = null;
		this.pendingImportMaxAge = 15 * 60 * 1000;

		if (this.pageType === 'standard') {
			this.table = document.getElementById('rubric-criteria');
			this.tbody = this.table?.lastElementChild || null;
			this.addCriterionButton = document.getElementById('rubric-criteria-addcriterion');
			this.rubric = document.getElementById('fitem_id_rubric');
		}

		if (this.pageType) {
			this.init();
		}
	}

	detectPageType() {
		if (document.getElementById('fitem_id_rubric') && document.getElementById('rubric-criteria')) {
			return 'standard';
		}

		const strategyInput = document.querySelector('input[name="strategy"]');
		const firstDimension = document.getElementById('id_dimension0');

		if (strategyInput?.value === 'rubric' && firstDimension) {
			return 'workshop';
		}

		return null;
	}

	async init() {
		await this.i18n.init();
		this.injectToastContainer();
		const dropZoneWrapper = this.createDropZone();

		if (this.pageType === 'standard') {
			this.rubric.prepend(dropZoneWrapper);
		} else {
			const firstDimension = document.getElementById('id_dimension0');
			firstDimension.parentElement.insertBefore(dropZoneWrapper, firstDimension);
			await this.resumeWorkshopImport();
		}
	}

	t(name, substitutions = []) {
		return this.i18n.getMessage(name, substitutions);
	}

	injectToastContainer() {
		if (document.getElementById('rubric-importer-toast-container')) return;

		const container = document.createElement('div');
		container.id = 'rubric-importer-toast-container';
		container.setAttribute('aria-live', 'polite');
		container.setAttribute('aria-atomic', 'true');
		document.body.appendChild(container);
	}

	showToast(message, type = 'info') {
		const container = document.getElementById('rubric-importer-toast-container');
		if (!container) return;

		const toast = document.createElement('div');
		toast.className = `rubric-importer-toast ${type}`;
		toast.textContent = message;
		toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
		container.replaceChildren(toast);

		requestAnimationFrame(() => toast.classList.add('show'));

		setTimeout(() => {
			toast.classList.remove('show');
			setTimeout(() => toast.remove(), 300);
		}, 5000);
	}

	createDropZone() {
		const wrapper = document.createElement('div');
		wrapper.classList.add('form-group', 'rubric-importer-wrapper');

		const dropZone = document.createElement('button');
		dropZone.type = 'button';
		dropZone.classList.add('rubric-importer-dropzone');
		dropZone.setAttribute('aria-label', this.t('dropZoneTitle'));
		dropZone.title = this.t('dropZoneTitle');
		this.dropZone = dropZone;

		const icon = document.createElement('span');
		icon.classList.add('icon');
		icon.textContent = 'MoodlIA Rubrics';
		icon.setAttribute('aria-hidden', 'true');

		const description = document.createElement('span');
		description.classList.add('rubric-importer-dropzone-copy');
		const action = document.createElement('strong');
		action.textContent = this.t('dropZoneStrong');
		description.append(action, document.createTextNode(this.t('dropZoneText')));

		dropZone.append(icon, description);
		dropZone.addEventListener('click', (event) => this.onDropZoneClick(event));
		dropZone.addEventListener('dragover', (event) => {
			event.preventDefault();
			event.stopPropagation();
			dropZone.classList.add('dragover');
		});
		dropZone.addEventListener('dragleave', (event) => {
			event.preventDefault();
			event.stopPropagation();
			dropZone.classList.remove('dragover');
		});
		dropZone.addEventListener('drop', (event) => this.onDrop(event, dropZone));

		wrapper.append(dropZone);
		return wrapper;
	}

	setBusy(isBusy) {
		if (!this.dropZone) return;
		this.dropZone.disabled = isBusy;
		this.dropZone.setAttribute('aria-busy', String(isBusy));
	}

	selectFile(contentType) {
		return new Promise(resolve => {
			const input = document.createElement('input');
			input.type = 'file';
			input.accept = contentType;
			input.addEventListener('change', () => resolve(input.files[0]), { once: true });
			input.click();
		});
	}

	async waitForElement(selector, parent = document, timeout = 2000) {
		const start = Date.now();
		while (Date.now() - start < timeout) {
			const element = parent.querySelector(selector);
			if (element) return element;
			await new Promise(resolve => requestAnimationFrame(resolve));
		}
		throw new Error(`Timeout waiting for element: ${selector}`);
	}

	getStandardCriterionRows() {
		return Array.from(this.tbody?.children || []).filter(row => row.querySelector('.description'));
	}

	async newStandardCriterion() {
		if (!this.addCriterionButton) {
			throw new Error('The button for adding a rubric criterion was not found.');
		}

		this.addCriterionButton.click();
		await new Promise(resolve => setTimeout(resolve, 100));
	}

	async modifyStandardCriterion(criterionIndex, name) {
		const row = this.getStandardCriterionRows()[criterionIndex];
		if (!row) throw new Error(`Criterion row ${criterionIndex} was not found.`);

		const descriptionCell = row.querySelector('.description');
		if (!descriptionCell) throw new Error(`Criterion description ${criterionIndex} was not found.`);

		let textarea = descriptionCell.querySelector('textarea');
		if (!textarea) {
			(descriptionCell.firstElementChild || descriptionCell).click();
			textarea = await this.waitForElement('textarea', descriptionCell);
		}

		this.setControlValue(textarea, name);
		textarea.blur();
	}

	async newStandardLevel(criterionIndex) {
		const row = this.getStandardCriterionRows()[criterionIndex];
		const addLevelButton = row?.querySelector('.addlevel input, .addlevel button, .addlevel');

		if (!addLevelButton) {
			throw new Error(`The level button for criterion ${criterionIndex + 1} was not found.`);
		}

		addLevelButton.click();
		await new Promise(resolve => setTimeout(resolve, 100));
	}

	async modifyStandardLevel(criterionIndex, levelIndex, description, grade) {
		const row = this.getStandardCriterionRows()[criterionIndex];
		const levelCell = row?.querySelectorAll('table tbody tr td.level')[levelIndex];
		if (!levelCell) throw new Error(`Level ${levelIndex + 1} of criterion ${criterionIndex + 1} was not found.`);

		levelCell.click();
		const definitionInput = await this.waitForElement('.definition textarea', levelCell);
		const gradeInput = await this.waitForElement('.score input', levelCell);
		this.setControlValue(definitionInput, description);
		this.setControlValue(gradeInput, grade);
		gradeInput.blur();
	}

	async processStandardRubric(model) {
		for (let criterionIndex = 0; criterionIndex < model.criteria.length; criterionIndex++) {
			const criterion = model.criteria[criterionIndex];

			while (criterionIndex >= this.getStandardCriterionRows().length) {
				await this.newStandardCriterion();
			}

			await this.modifyStandardCriterion(criterionIndex, criterion.description);

			for (let levelIndex = 0; levelIndex < criterion.levels.length; levelIndex++) {
				const row = this.getStandardCriterionRows()[criterionIndex];
				const currentLevels = row.querySelectorAll('table tbody tr td.level');

				if (levelIndex >= currentLevels.length) {
					await this.newStandardLevel(criterionIndex);
				}

				const level = criterion.levels[levelIndex];
				await this.modifyStandardLevel(criterionIndex, levelIndex, level.definition, level.grade);
			}

			const row = this.getStandardCriterionRows()[criterionIndex];
			let currentLevels = row.querySelectorAll('table tbody tr td.level');
			while (currentLevels.length > criterion.levels.length) {
				const lastLevel = currentLevels[currentLevels.length - 1];
				const deleteButton = lastLevel.querySelector('.delete input, .delete button, .delete');
				if (!deleteButton) break;
				deleteButton.click();
				await new Promise(resolve => setTimeout(resolve, 50));
				currentLevels = row.querySelectorAll('table tbody tr td.level');
			}
		}
	}

	getWorkshopDimensions() {
		return Array.from(document.querySelectorAll('[id^="id_dimension"]'))
			.filter(element => /^id_dimension\d+$/.test(element.id))
			.sort((left, right) => this.getDimensionIndex(left) - this.getDimensionIndex(right));
	}

	getDimensionIndex(dimension) {
		return Number(dimension.id.replace('id_dimension', ''));
	}

	getWorkshopLevelFields(criterionIndex) {
		const dimension = document.getElementById(`id_dimension${criterionIndex}`);
		if (!dimension) return [];

		return Array.from(dimension.querySelectorAll(`select[id^="id_grade__idx_${criterionIndex}__idy_"]`))
			.map(gradeSelect => {
				const match = gradeSelect.id.match(/__idy_(\d+)$/);
				const levelIndex = match ? Number(match[1]) : -1;
				return {
					levelIndex,
					gradeSelect,
					definitionInput: document.getElementById(`id_definition__idx_${criterionIndex}__idy_${levelIndex}`)
				};
			})
			.filter(fields => fields.levelIndex >= 0 && fields.definitionInput)
			.sort((left, right) => left.levelIndex - right.levelIndex);
	}

	getWorkshopCapacitySignature() {
		return this.getWorkshopDimensions()
			.map(dimension => this.getWorkshopLevelFields(this.getDimensionIndex(dimension)).length)
			.join(',');
	}

	workshopHasContent() {
		return this.getWorkshopDimensions().some(dimension => {
			const criterionIndex = this.getDimensionIndex(dimension);
			const editorId = `id_description__idx_${criterionIndex}_editor`;
			const textarea = document.getElementById(editorId);
			const editorBody = document.getElementById(`${editorId}_ifr`)?.contentDocument?.body;
			const description = editorBody?.textContent || textarea?.value || '';
			const hasDescription = this.normalizeEditorText(description).length > 0;
			const hasDefinition = this.getWorkshopLevelFields(criterionIndex)
				.some(fields => fields.definitionInput.value.trim().length > 0);

			return hasDescription || hasDefinition;
		});
	}

	normalizeEditorText(value) {
		const container = document.createElement('div');
		container.innerHTML = String(value || '');
		return (container.textContent || '').replace(/\u00a0/g, ' ').trim();
	}

	plainTextToHtml(value) {
		const container = document.createElement('div');
		const lines = String(value).split(/\r?\n/);

		for (let index = 0; index < lines.length; index++) {
			if (index > 0) container.appendChild(document.createElement('br'));
			container.appendChild(document.createTextNode(lines[index]));
		}

		return container.innerHTML;
	}

	setWorkshopDescription(criterionIndex, description) {
		const editorId = `id_description__idx_${criterionIndex}_editor`;
		const textarea = document.getElementById(editorId);
		const editorFrame = document.getElementById(`${editorId}_ifr`);
		const html = description ? this.plainTextToHtml(description) : '';

		if (!textarea) {
			throw new Error(`The description editor for criterion ${criterionIndex + 1} was not found.`);
		}

		this.setControlValue(textarea, html);

		if (editorFrame?.contentDocument?.body) {
			editorFrame.contentDocument.body.innerHTML = html;
			editorFrame.contentDocument.body.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
			editorFrame.contentDocument.body.dispatchEvent(new Event('change', { bubbles: true }));
		}
	}

	setControlValue(control, value) {
		control.value = String(value);
		control.dispatchEvent(new Event('input', { bubbles: true }));
		control.dispatchEvent(new Event('change', { bubbles: true }));
	}

	fillWorkshopPass(model) {
		let needsMoreLevels = false;
		const dimensions = this.getWorkshopDimensions();

		for (let criterionIndex = 0; criterionIndex < dimensions.length; criterionIndex++) {
			const criterion = model.criteria[criterionIndex];
			const levelFields = this.getWorkshopLevelFields(criterionIndex);

			this.setWorkshopDescription(criterionIndex, criterion?.description || '');

			for (let levelIndex = 0; levelIndex < levelFields.length; levelIndex++) {
				const fields = levelFields[levelIndex];
				const level = criterion?.levels[levelIndex];

				if (level) {
					this.setControlValue(fields.gradeSelect, level.grade);
					if (fields.gradeSelect.value !== String(level.grade)) {
						throw new Error(`Moodle rejected grade ${level.grade} in criterion ${criterionIndex + 1}.`);
					}
					this.setControlValue(fields.definitionInput, level.definition);
				} else {
					this.setControlValue(fields.definitionInput, '');
				}
			}

			if (criterion && criterion.levels.length > levelFields.length) {
				needsMoreLevels = true;
			}
		}

		return needsMoreLevels;
	}

	async processWorkshopRubric(model, pendingImport = null) {
		const validation = RubricImportModel.validateWorkshop(model);
		if (!validation.valid) {
			throw new Error(this.t('workshopInvalidCriterion', [validation.criterionNumber]));
		}

		const isResuming = Boolean(pendingImport);
		if (!isResuming && this.workshopHasContent()) {
			const shouldReplace = window.confirm(this.t('workshopReplaceConfirmation'));
			if (!shouldReplace) return { cancelled: true };
		}

		const dimensions = this.getWorkshopDimensions();
		if (pendingImport?.stage === 'dimensions' && dimensions.length < model.criteria.length) {
			this.clearPendingWorkshopImport();
			throw new Error(this.t('workshopExpansionFailed'));
		}

		if (dimensions.length < model.criteria.length) {
			const addDimensionsButton = document.getElementById('id_adddims');
			const repeatsInput = document.querySelector('input[name="norepeats"]');

			if (!addDimensionsButton || !repeatsInput) {
				throw new Error(this.t('workshopExpansionFailed'));
			}

			this.savePendingWorkshopImport(model, {
				stage: 'dimensions',
				autoSaveApproved: pendingImport?.autoSaveApproved || false,
				attempts: pendingImport?.attempts || 0
			});
			this.setControlValue(repeatsInput, Math.max(1, model.criteria.length - 2));
			addDimensionsButton.click();
			return { navigating: true };
		}

		const currentSignature = this.getWorkshopCapacitySignature();
		if (pendingImport?.stage === 'levels' && pendingImport.capacitySignature === currentSignature) {
			this.clearPendingWorkshopImport();
			throw new Error(this.t('workshopExpansionFailed'));
		}

		const requiresAdditionalLevelPass = model.criteria.some((criterion, criterionIndex) => {
			return criterion.levels.length > this.getWorkshopLevelFields(criterionIndex).length;
		});
		let autoSaveApproved = pendingImport?.autoSaveApproved || false;

		if (requiresAdditionalLevelPass && !autoSaveApproved) {
			autoSaveApproved = window.confirm(this.t('workshopAutoSaveConfirmation'));
			if (!autoSaveApproved) {
				this.clearPendingWorkshopImport();
				return { cancelled: true };
			}
		}

		const needsMoreLevels = this.fillWorkshopPass(model);
		if (!needsMoreLevels) {
			this.clearPendingWorkshopImport();
			return { completed: true };
		}

		const attempts = (pendingImport?.attempts || 0) + 1;
		if (attempts > 50) {
			this.clearPendingWorkshopImport();
			throw new Error(this.t('workshopExpansionFailed'));
		}

		const saveAndContinueButton = document.getElementById('id_saveandcontinue');
		if (!saveAndContinueButton) {
			throw new Error(this.t('workshopExpansionFailed'));
		}

		this.savePendingWorkshopImport(model, {
			stage: 'levels',
			autoSaveApproved,
			attempts,
			capacitySignature: currentSignature
		});
		await new Promise(resolve => setTimeout(resolve, 100));
		saveAndContinueButton.click();
		return { navigating: true };
	}

	getPendingWorkshopKey() {
		const courseModuleId = new URLSearchParams(window.location.search).get('cmid') || 'unknown';
		return `moodlia-rubrics-workshop-${courseModuleId}`;
	}

	savePendingWorkshopImport(model, state) {
		const pendingImport = {
			...state,
			model,
			createdAt: Date.now()
		};
		sessionStorage.setItem(this.getPendingWorkshopKey(), JSON.stringify(pendingImport));
	}

	readPendingWorkshopImport() {
		const rawValue = sessionStorage.getItem(this.getPendingWorkshopKey());
		if (!rawValue) return null;

		try {
			const pendingImport = JSON.parse(rawValue);
			if (!pendingImport.model || Date.now() - pendingImport.createdAt > this.pendingImportMaxAge) {
				this.clearPendingWorkshopImport();
				return null;
			}
			return pendingImport;
		} catch (_error) {
			this.clearPendingWorkshopImport();
			return null;
		}
	}

	clearPendingWorkshopImport() {
		sessionStorage.removeItem(this.getPendingWorkshopKey());
	}

	async resumeWorkshopImport() {
		const pendingImport = this.readPendingWorkshopImport();
		if (!pendingImport) return;

		this.setBusy(true);
		this.showToast(this.t('startingImport'), 'info');

		try {
			const result = await this.processWorkshopRubric(pendingImport.model, pendingImport);
			if (result.completed) {
				this.showToast(this.t('workshopImportCompleted'), 'success');
			}
			if (!result.navigating) this.setBusy(false);
		} catch (error) {
			console.error('Failed to resume Workshop rubric import', error);
			this.clearPendingWorkshopImport();
			this.setBusy(false);
			this.showToast(this.t('importError', [error.message]), 'error');
		}
	}

	async processWorkbook(data, fileName) {
		this.setBusy(true);

		try {
			const sheet = await RubricWorkbookParser.parse(fileName, data);
			const model = RubricImportModel.fromSheet(sheet);
			this.showToast(this.t('startingImport'), 'info');

			if (this.pageType === 'workshop') {
				const result = await this.processWorkshopRubric(model);
				if (result.completed) {
					this.showToast(this.t('workshopImportCompleted'), 'success');
				}
				if (!result.navigating) this.setBusy(false);
				return;
			}

			await this.processStandardRubric(model);
			this.showToast(this.t('importCompleted'), 'success');
			this.setBusy(false);
		} catch (error) {
			console.error('Failed to import rubric', error);
			this.setBusy(false);
			this.showToast(this.t('importError', [error.message]), 'error');
		}
	}

	async readFile(file) {
		try {
			const fileContent = await file.arrayBuffer();
			await this.processWorkbook(fileContent, file.name);
		} catch (error) {
			console.error('Failed to read rubric file', error);
			this.setBusy(false);
			this.showToast(this.t('readFileError'), 'error');
		}
	}

	async onDropZoneClick(event) {
		event.preventDefault();

		try {
			const file = await this.selectFile('.csv');
			if (file) await this.readFile(file);
		} catch (error) {
			console.error('Failed to select rubric file', error);
			this.showToast(this.t('selectFileError'), 'error');
		}
	}

	onDrop(event, dropZone) {
		event.preventDefault();
		event.stopPropagation();
		dropZone.classList.remove('dragover');

		const file = event.dataTransfer.files[0];
		if (!file) return;

		if (file.name.toLowerCase().endsWith('.csv')) {
			this.readFile(file);
		} else {
			this.showToast(this.t('invalidFileType'), 'error');
		}
	}
}

if (!window.__rubricandoImporterLoaded) {
	window.__rubricandoImporterLoaded = true;
	new RubricImporter();
}
