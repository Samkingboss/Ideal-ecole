import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // Les fonctions serveur Vercel tournent sous Node, pas dans un
    // navigateur : `process` et `Buffer` y sont légitimes. Sans ce bloc,
    // eslint les signalait comme des variables inconnues — cinq erreurs
    // qui auraient poussé à relever le plafond du cliquet pour du bruit.
    files: ['api/**/*.js'],
    languageOptions: { globals: globals.node },
    rules: {
      // Une fonction serverless exporte son gestionnaire par défaut : la
      // règle de Fast Refresh, pensée pour les composants React, n'a
      // aucun sens ici.
      'react-refresh/only-export-components': 'off',
    },
  },
])
