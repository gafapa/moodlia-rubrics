(function initializeOptionsPage() {
	const message = (key) => chrome.i18n.getMessage(key) || key;
	const hostInput = document.getElementById('host-input');
	const addHostButton = document.getElementById('add-host');
	const hostList = document.getElementById('host-list');
	const hostEmpty = document.getElementById('host-empty');
	const status = document.getElementById('status');

	document.title = message('optionsDocumentTitle');
	document.querySelectorAll('[data-i18n]').forEach((element) => {
		element.textContent = message(element.dataset.i18n);
	});
	document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
		element.setAttribute('placeholder', message(element.dataset.i18nPlaceholder));
	});

	async function renderSites() {
		const builtInSites = RubricandoHostAccess.getBuiltInSites();
		const storedSites = await RubricandoHostAccess.getStoredSites();
		const sites = [...builtInSites, ...storedSites];
		hostList.innerHTML = '';
		hostEmpty.hidden = sites.length > 0;

		for (const site of sites) {
			const listItem = document.createElement('li');
			listItem.className = 'host-item';

			const textWrapper = document.createElement('div');
			const title = document.createElement('strong');
			title.textContent = site.label;
			if (site.builtIn) {
				const badge = document.createElement('span');
				badge.className = 'host-badge';
				badge.textContent = message('optionsBuiltIn');
				title.append(' ', badge);
			}
			const subtitle = document.createElement('span');
			subtitle.textContent = RubricandoHostAccess.buildMatches(site).join(' | ');
			textWrapper.append(title, subtitle);

			listItem.append(textWrapper);

			if (!site.builtIn) {
				const removeButton = document.createElement('button');
				removeButton.type = 'button';
				removeButton.textContent = message('optionsRemove');
				removeButton.addEventListener('click', async () => {
					await removeSite(site);
				});
				listItem.appendChild(removeButton);
			}

			hostList.appendChild(listItem);
		}
	}

	function setStatus(text, type = '') {
		status.textContent = text;
		status.className = `options-status${type ? ` ${type}` : ''}`;
	}

	async function addSite() {
		setStatus('');

		let site;
		try {
			site = RubricandoHostAccess.normalizeInput(hostInput.value);
		} catch (_error) {
			setStatus(message('optionsInvalidUrl'), 'error');
			return;
		}

		if (RubricandoHostAccess.isBuiltInSite(site)) {
			setStatus(message('optionsAlreadyBuiltIn'), 'success');
			hostInput.value = '';
			await renderSites();
			return;
		}

		const granted = await chrome.permissions.request({ origins: [site.originPattern] });
		if (!granted) {
			setStatus(message('optionsPermissionDenied'), 'error');
			return;
		}

		const sites = await RubricandoHostAccess.getStoredSites();
		if (!sites.some(existingSite => existingSite.id === site.id)) {
			sites.push(site);
			sites.sort((leftSite, rightSite) => leftSite.label.localeCompare(rightSite.label));
			await RubricandoHostAccess.saveStoredSites(sites);
		}

		await chrome.runtime.sendMessage({ type: 'sync-sites' });
		hostInput.value = '';
		setStatus(message('optionsRequestSuccess'), 'success');
		await renderSites();
	}

	async function removeSite(site) {
		const sites = await RubricandoHostAccess.getStoredSites();
		const updatedSites = sites.filter(existingSite => existingSite.id !== site.id);

		await RubricandoHostAccess.saveStoredSites(updatedSites);
		await chrome.permissions.remove({ origins: [site.originPattern] });
		await chrome.runtime.sendMessage({ type: 'sync-sites' });
		setStatus(message('optionsRemoved'), 'success');
		await renderSites();
	}

	addHostButton.addEventListener('click', () => {
		addSite();
	});

	hostInput.addEventListener('keydown', (event) => {
		if (event.key === 'Enter') {
			event.preventDefault();
			addSite();
		}
	});

	renderSites();
})();
