(async function initializeWhatsNew() {
	const i18n = new RubricImporterI18n();
	await i18n.init();
	document.documentElement.lang = i18n.locale.replace('_', '-');
	document.title = i18n.getMessage('whatsNewDocumentTitle');
	document.querySelectorAll('[data-i18n]').forEach((element) => {
		element.textContent = i18n.getMessage(element.dataset.i18n);
	});
})();
