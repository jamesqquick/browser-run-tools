import { takeScreenshot } from './takeScreenshot';
import { takeFullPageScreenshot } from './takeFullPageScreenshot';
import { compareViewports } from './compareViewports';
import { summarizeHomepage } from './summarizeHomepage';
import { compareDarkLight } from './compareDarkLight';
import { extractColors } from './extractColors';
import { extractOg } from './extractOg';
import { auditMeta } from './auditMeta';
import { checkLinks } from './checkLinks';
import { extractFonts } from './extractFonts';
import { measurePerformance } from './measurePerformance';

export const server = {
  takeScreenshot,
  takeFullPageScreenshot,
  compareViewports,
  summarizeHomepage,
  compareDarkLight,
  extractColors,
  extractOg,
  auditMeta,
  checkLinks,
  extractFonts,
  measurePerformance,
};
