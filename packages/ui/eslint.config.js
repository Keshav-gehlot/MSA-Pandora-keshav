import { globalIgnores } from "eslint/config";
import base from "@pandora/config/eslint/package";

export default [...base, globalIgnores(["src/theme/**"])];
