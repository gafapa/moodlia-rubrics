class RubricImporterI18n {
	constructor() {
		this.defaultLocale = 'es';
		this.supportedLocales = ['en', 'es', 'fr', 'de', 'pt', 'pt_PT', 'pt_BR', 'gl', 'ca', 'eu'];
		this.messages = {};
		this.defaultMessages = {};
		this.locale = this.defaultLocale;
	}

	async init() {
		this.locale = this.resolveLocale(this.getCandidateLocales());
		this.defaultMessages = await this.loadMessages(this.defaultLocale);
		this.messages = this.locale === this.defaultLocale
			? this.defaultMessages
			: await this.loadMessages(this.locale);
	}

	getMessage(name, substitutions = []) {
		const normalizedSubstitutions = Array.isArray(substitutions) ? substitutions : [substitutions];
		const entry = this.messages[name] || this.defaultMessages[name];

		if (!entry) return name;

		return this.applyPlaceholders(entry, normalizedSubstitutions);
	}

	getCandidateLocales() {
		const locales = [];
		const pageLanguage = document.documentElement.lang;

		if (pageLanguage) locales.push(pageLanguage);

		if (Array.isArray(navigator.languages)) {
			locales.push(...navigator.languages);
		}

		if (navigator.language) locales.push(navigator.language);

		if (typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage) {
			locales.push(chrome.i18n.getUILanguage());
		}

		return locales;
	}

	resolveLocale(locales) {
		for (const locale of locales) {
			const resolvedLocale = this.matchLocale(locale);
			if (resolvedLocale) return resolvedLocale;
		}

		return this.defaultLocale;
	}

	matchLocale(locale) {
		if (!locale) return null;

		const normalizedLocale = locale.replace('-', '_');
		const lowerLocale = normalizedLocale.toLowerCase();
		const aliases = {
			ca_es: 'ca',
			de_de: 'de',
			en_gb: 'en',
			en_us: 'en',
			es_es: 'es',
			eu_es: 'eu',
			fr_fr: 'fr',
			gl_es: 'gl',
			pt_br: 'pt_BR',
			pt_pt: 'pt_PT'
		};

		if (this.supportedLocales.includes(normalizedLocale)) {
			return normalizedLocale;
		}

		if (aliases[lowerLocale]) {
			return aliases[lowerLocale];
		}

		const baseLocale = lowerLocale.split('_')[0];

		if (aliases[baseLocale]) {
			return aliases[baseLocale];
		}

		if (this.supportedLocales.includes(baseLocale)) {
			return baseLocale;
		}

		return null;
	}

	async loadMessages(locale) {
		try {
			const url = typeof chrome !== 'undefined' && chrome.runtime?.getURL
				? chrome.runtime.getURL(`_locales/${locale}/messages.json`)
				: `../_locales/${locale}/messages.json`;
			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`Unable to load locale ${locale}`);
			}

			return await response.json();
		} catch (error) {
			console.warn(`Falling back from locale ${locale}`, error);
			return locale === this.defaultLocale ? {} : this.defaultMessages;
		}
	}

	applyPlaceholders(entry, substitutions) {
		let message = entry.message || '';
		const placeholders = entry.placeholders || {};

		for (const [placeholderName, placeholder] of Object.entries(placeholders)) {
			const value = this.resolvePlaceholderValue(placeholder.content, substitutions);
			const token = `$${placeholderName}$`;
			const upperToken = `$${placeholderName.toUpperCase()}$`;

			message = message.replaceAll(token, value).replaceAll(upperToken, value);
		}

		return message.replace(/\$(\d+)/g, (_, index) => substitutions[Number(index) - 1] ?? '');
	}

	resolvePlaceholderValue(content, substitutions) {
		const match = String(content || '').match(/^\$(\d+)$/);

		if (!match) return content || '';

		return substitutions[Number(match[1]) - 1] ?? '';
	}
}

window.RubricImporterI18n = RubricImporterI18n;
