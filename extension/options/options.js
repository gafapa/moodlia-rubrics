(async function initializeOptionsPage() {
	// The shared loader also covers Galician and Basque, which chrome.i18n does not.
	const i18n = new RubricImporterI18n();
	await i18n.init();
	const message = (key) => i18n.getMessage(key);
	document.documentElement.lang = i18n.locale.replace('_', '-');
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
		const sites = await RubricandoHostAccess.getStoredSites();
		hostList.innerHTML = '';
		hostEmpty.hidden = sites.length > 0;

		for (const site of sites) {
			const granted = await RubricandoHostAccess.hasOriginPermission(site.originPattern);
			const listItem = document.createElement('li');
			listItem.className = 'host-item';

			const textWrapper = document.createElement('div');
			const title = document.createElement('strong');
			title.textContent = site.label;
			if (!granted) {
				const missing = document.createElement('span');
				missing.className = 'host-status';
				missing.textContent = message('optionsPermissionMissing');
				title.append(missing);
			}
			const subtitle = document.createElement('span');
			subtitle.textContent = RubricandoHostAccess.buildMatches(site).join(' | ');
			textWrapper.append(title, subtitle);
			listItem.append(textWrapper);

			if (!granted) {
				const grantButton = document.createElement('button');
				grantButton.type = 'button';
				grantButton.textContent = message('optionsGrant');
				grantButton.addEventListener('click', async () => {
					await grantSite(site);
				});
				listItem.appendChild(grantButton);
			}

			const removeButton = document.createElement('button');
			removeButton.type = 'button';
			removeButton.textContent = message('optionsRemove');
			removeButton.addEventListener('click', async () => {
				await removeSite(site);
			});
			listItem.appendChild(removeButton);

			hostList.appendChild(listItem);
		}
	}

	async function grantSite(site) {
		const granted = await chrome.permissions.request({ origins: [site.originPattern] });
		if (!granted) {
			setStatus(message('optionsPermissionDenied'), 'error');
			return;
		}
		await chrome.runtime.sendMessage({ type: 'sync-sites' });
		setStatus(message('optionsRequestSuccess'), 'success');
		await renderSites();
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

		const granted = await chrome.permissions.request({ origins: [site.originPattern] });
		if (!granted) {
			setStatus(message('optionsPermissionDenied'), 'error');
			return;
		}

		await RubricandoHostAccess.addStoredSite(site);

		await chrome.runtime.sendMessage({ type: 'sync-sites' });
		hostInput.value = '';
		setStatus(message('optionsRequestSuccess'), 'success');
		await renderSites();
	}

	async function removeSite(site) {
		await RubricandoHostAccess.removeStoredSite(site);
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
