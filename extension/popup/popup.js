(async function initializePopup() {
	const i18n = new RubricImporterI18n();
	await i18n.init();
	const message = (key) => i18n.getMessage(key);
	document.documentElement.lang = i18n.locale.replace('_', '-');
	document.querySelectorAll('[data-i18n]').forEach((element) => {
		element.textContent = message(element.dataset.i18n);
	});

	const status = document.getElementById('status');
	const alwaysSection = document.getElementById('always-section');
	const siteLabel = document.getElementById('site-label');
	const alwaysHint = document.getElementById('always-hint');
	const alwaysButton = document.getElementById('always-button');
	const alwaysOn = document.getElementById('always-on');
	const alwaysOffButton = document.getElementById('always-off-button');

	document.getElementById('manage-sites').addEventListener('click', () => {
		chrome.runtime.openOptionsPage();
		window.close();
	});

	function setStatus(key, type = '') {
		status.textContent = message(key);
		status.className = `popup-status${type ? ` ${type}` : ''}`;
	}

	// Opening the popup grants activeTab, which exposes the tab URL and allows one injection.
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	if (!tab?.id || !RubricandoHostAccess.isRubricPageUrl(tab.url)) {
		setStatus('popupNotRubricPage');
		return;
	}

	try {
		await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: RubricandoHostAccess.contentStyles });
		await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: RubricandoHostAccess.contentScripts });
		setStatus('popupActivated', 'success');
	} catch (error) {
		console.error('Failed to activate the rubric importer', error);
		setStatus('popupActivationFailed', 'error');
		return;
	}

	const site = RubricandoHostAccess.normalizeInput(tab.url);
	siteLabel.textContent = site.label;
	alwaysSection.hidden = false;

	async function renderAlwaysState() {
		const stored = await RubricandoHostAccess.findStoredSite(site);
		const granted = await RubricandoHostAccess.hasOriginPermission(site.originPattern);
		const always = Boolean(stored) && granted;
		alwaysHint.hidden = always;
		alwaysButton.hidden = always;
		alwaysOn.hidden = !always;
		alwaysOffButton.hidden = !always;
	}

	alwaysButton.addEventListener('click', async () => {
		// Store the site first: Chrome may close this popup while it shows the permission
		// prompt, and the service worker registers stored sites when the permission arrives.
		await RubricandoHostAccess.addStoredSite(site);
		const granted = await chrome.permissions.request({ origins: [site.originPattern] });
		if (!granted) {
			await RubricandoHostAccess.removeStoredSite(site);
			setStatus('optionsPermissionDenied', 'error');
		}
		await chrome.runtime.sendMessage({ type: 'sync-sites' });
		await renderAlwaysState();
	});

	alwaysOffButton.addEventListener('click', async () => {
		await RubricandoHostAccess.removeStoredSite(site);
		await chrome.permissions.remove({ origins: [site.originPattern] });
		await chrome.runtime.sendMessage({ type: 'sync-sites' });
		await renderAlwaysState();
	});

	await renderAlwaysState();
})();
