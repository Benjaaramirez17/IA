/**
 * Generador Asegurado SHOPPERS — Web App de Google Apps Script.
 *
 * Todo el procesamiento del Excel (lectura, transformación y generación
 * del archivo de salida) ocurre en el navegador del usuario con ExcelJS;
 * este script solo aloja la página. No lee ni escribe ninguna Hoja de
 * cálculo ni archivo de Drive.
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Generador Asegurado SHOPPERS')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Incluye el contenido de otro archivo HTML del proyecto (partial). */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
