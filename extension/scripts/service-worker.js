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

// Version 1.2.0 stopped running automatically on the Xunta Moodle hosts; tell people who used an
// earlier version how to activate the importer now.
const behaviourChangeVersion = '1.2.0';

function isOlderVersion(version, reference) {
	const left = String(version || '0').split('.').map(part => Number.parseInt(part, 10) || 0);
	const right = reference.split('.').map(part => Number.parseInt(part, 10) || 0);
	for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
		if ((left[index] || 0) !== (right[index] || 0)) {
			return (left[index] || 0) < (right[index] || 0);
		}
	}
	return false;
}

chrome.runtime.onInstalled.addListener((details) => {
	syncSites().catch(() => {});

	if (details.reason === 'update' && isOlderVersion(details.previousVersion, behaviourChangeVersion)) {
		chrome.tabs.create({ url: chrome.runtime.getURL('whats-new/index.html') }).catch(() => {});
	}
});

// "Always activate on this site" may close the popup while Chrome shows the permission prompt,
// so registration follows the permission itself rather than the popup.
chrome.permissions.onAdded.addListener(() => {
	syncSites().catch(() => {});
});

chrome.permissions.onRemoved.addListener(() => {
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
