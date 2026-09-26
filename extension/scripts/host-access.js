const RubricandoHostAccess = {
	storageKey: 'allowedMoodleSites',
	storageArea: 'local',
	legacyStorageArea: 'sync',
	contentScriptPrefix: 'rubricando-site-',
	contentStyles: ['styles/main.css', 'styles/toast.css', 'styles/dropzone.css'],
	contentScripts: ['scripts/workbook.js', 'scripts/rubric-model.js', 'scripts/i18n.js', 'scripts/content.js'],
	rubricPathSuffixes: [
		'/grade/grading/form/rubric/edit.php*',
		'/mod/workshop/editform.php*'
	],

	normalizeInput(rawValue) {
		const trimmedValue = String(rawValue || '').trim();
		if (!trimmedValue) {
			throw new Error('Host is required');
		}

		const normalizedUrl = trimmedValue.match(/^https?:\/\//i) ? trimmedValue : `https://${trimmedValue}`;
		const parsedUrl = new URL(normalizedUrl);

		if (parsedUrl.protocol !== 'https:') {
			throw new Error('Only HTTPS hosts are supported');
		}

		const basePath = this.extractBasePath(parsedUrl.pathname);
		const origin = parsedUrl.origin;

		return {
			id: this.buildSiteId(origin, basePath),
			originPattern: `${origin}/*`,
			basePath,
			label: `${origin}${basePath}`
		};
	},

	extractBasePath(pathname) {
		const rubricPaths = this.rubricPathSuffixes.map(pathSuffix => pathSuffix.replace(/\*$/, ''));
		const rubricIndexes = rubricPaths
			.map(rubricPath => pathname.indexOf(rubricPath))
			.filter(index => index >= 0);
		const rubricIndex = rubricIndexes.length > 0 ? Math.min(...rubricIndexes) : -1;
		const rawBasePath = rubricIndex >= 0 ? pathname.slice(0, rubricIndex) : pathname;
		const normalizedBasePath = rawBasePath.replace(/\/+$/, '');

		if (!normalizedBasePath || normalizedBasePath === '/') {
			return '';
		}

		return normalizedBasePath.startsWith('/') ? normalizedBasePath : `/${normalizedBasePath}`;
	},

	// True for an HTTPS assignment rubric editor or Workshop form URL on any Moodle.
	isRubricPageUrl(rawUrl) {
		let parsedUrl;
		try {
			parsedUrl = new URL(String(rawUrl || ''));
		} catch (_error) {
			return false;
		}

		if (parsedUrl.protocol !== 'https:') {
			return false;
		}

		return this.rubricPathSuffixes
			.map(pathSuffix => pathSuffix.replace(/\*$/, ''))
			.some(rubricPath => parsedUrl.pathname.endsWith(rubricPath));
	},

	buildSiteId(origin, basePath) {
		const source = `${origin}${basePath}`.toLowerCase();
		const sanitized = source.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
		return sanitized || 'root';
	},

	buildContentScriptId(site) {
		return `${this.contentScriptPrefix}${site.id}`;
	},

	buildMatches(site) {
		if (Array.isArray(site.matches)) {
			return site.matches;
		}

		const origin = site.originPattern.replace(/\/\*$/, '');
		return this.rubricPathSuffixes.map(pathSuffix => `${origin}${site.basePath}${pathSuffix}`);
	},

	async getStoredSites() {
		await this.migrateLegacySites();
		const storedValue = await chrome.storage[this.storageArea].get(this.storageKey);
		const sites = storedValue[this.storageKey];
		return Array.isArray(sites) ? this.normalizeStoredSites(sites) : [];
	},

	async saveStoredSites(sites) {
		await chrome.storage[this.storageArea].set({ [this.storageKey]: this.normalizeStoredSites(sites) });
	},

	normalizeStoredSites(sites) {
		const normalizedSites = [];
		const seenIds = new Set();

		for (const site of sites) {
			if (!site || typeof site !== 'object') continue;
			if (!site.originPattern?.startsWith('https://')) continue;
			if (!site.id || seenIds.has(site.id)) continue;

			seenIds.add(site.id);
			normalizedSites.push(site);
		}

		return normalizedSites.sort((leftSite, rightSite) => {
			return String(leftSite.label || '').localeCompare(String(rightSite.label || ''));
		});
	},

	async migrateLegacySites() {
		const localValue = await chrome.storage[this.storageArea].get(this.storageKey);
		const localSites = localValue[this.storageKey];

		if (Array.isArray(localSites) && localSites.length > 0) {
			return;
		}

		const legacyValue = await chrome.storage[this.legacyStorageArea].get(this.storageKey);
		const legacySites = legacyValue[this.storageKey];

		if (!Array.isArray(legacySites) || legacySites.length === 0) {
			return;
		}

		await chrome.storage[this.storageArea].set({ [this.storageKey]: legacySites });
		await chrome.storage[this.legacyStorageArea].remove(this.storageKey);
	},

	async findStoredSite(site) {
		const sites = await this.getStoredSites();
		return sites.find(storedSite => storedSite.id === site.id) || null;
	},

	async addStoredSite(site) {
		const sites = await this.getStoredSites();
		if (!sites.some(storedSite => storedSite.id === site.id)) {
			sites.push(site);
			await this.saveStoredSites(sites);
		}
	},

	async removeStoredSite(site) {
		const sites = await this.getStoredSites();
		await this.saveStoredSites(sites.filter(storedSite => storedSite.id !== site.id));
	},

	async hasOriginPermission(originPattern) {
		try {
			return await chrome.permissions.contains({ origins: [originPattern] });
		} catch (_error) {
			return false;
		}
	},

	async syncRegisteredSites() {
		const storedSites = await this.getStoredSites();
		const grantedSites = [];

		for (const site of storedSites) {
			if (await this.hasOriginPermission(site.originPattern)) {
				grantedSites.push(site);
			}
		}

		const registeredScripts = await chrome.scripting.getRegisteredContentScripts();
		const currentIds = registeredScripts
			.map(script => script.id)
			.filter(id => id.startsWith(this.contentScriptPrefix));
		const desiredIds = [...new Set(grantedSites.map(site => this.buildContentScriptId(site)))];
		const idsToRemove = currentIds.filter(id => !desiredIds.includes(id));

		if (idsToRemove.length > 0) {
			await chrome.scripting.unregisterContentScripts({ ids: idsToRemove });
		}

		const registrations = this.dedupeRegistrations(grantedSites.map(site => ({
			id: this.buildContentScriptId(site),
			matches: this.buildMatches(site),
			css: this.contentStyles,
			js: this.contentScripts,
			runAt: 'document_idle',
			persistAcrossSessions: true
		})));

		if (registrations.length === 0) {
			return grantedSites;
		}

		const existingScriptIds = new Set(currentIds);
		const scriptsToRegister = registrations.filter(script => !existingScriptIds.has(script.id));
		const scriptsToUpdate = registrations.filter(script => existingScriptIds.has(script.id));

		if (scriptsToRegister.length > 0) {
			try {
				await chrome.scripting.registerContentScripts(scriptsToRegister);
			} catch (error) {
				if (!String(error.message).includes('Duplicate script ID')) {
					throw error;
				}
			}
		}

		if (scriptsToUpdate.length > 0) {
			await chrome.scripting.updateContentScripts(scriptsToUpdate);
		}

		return grantedSites;
	},

	dedupeRegistrations(registrations) {
		const uniqueRegistrations = new Map();

		for (const registration of registrations) {
			uniqueRegistrations.set(registration.id, registration);
		}

		return [...uniqueRegistrations.values()];
	}
};

globalThis.RubricandoHostAccess = RubricandoHostAccess;
