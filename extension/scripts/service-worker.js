importScripts('host-access.js');

let syncPromise = null;

async function syncSites() {
	if (!syncPromise) {
		syncPromise = RubricandoHostAccess.syncRegisteredSites()
			.catch((error) => {
				console.error('Failed to sync Moodle site registrations', error);
				throw error;
			})
			.finally(() => {
				syncPromise = null;
			});
	}

	return syncPromise;
}

chrome.runtime.onInstalled.addListener(() => {
	syncSites().catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
	syncSites().catch(() => {});
});

chrome.storage.onChanged.addListener((changes, areaName) => {
	if (areaName === RubricandoHostAccess.storageArea && changes[RubricandoHostAccess.storageKey]) {
		syncSites().catch(() => {});
	}
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message?.type !== 'sync-sites') {
		return;
	}

	syncSites()
		.then(() => sendResponse({ ok: true }))
		.catch((error) => sendResponse({ ok: false, error: error.message }));

	return true;
});

chrome.action.onClicked.addListener(() => {
	chrome.runtime.openOptionsPage();
});
