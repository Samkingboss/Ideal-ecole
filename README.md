# IDEAL EcoleApp

Application de gestion scolaire pour IDEAL École Internationale Bilingue (Bamako, Mali).

## Rôles
- **Directeur** : code ADMIN2025 (à changer dans Supabase)
- **Professeur** : code généré par le directeur
- **Surveillant** : code généré par le directeur

## Déploiement
1. Pousser ce dépôt sur GitHub
2. Connecter le dépôt à Netlify
3. Ajouter les variables d'environnement dans Netlify :
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY

## Base de données
Exécuter le fichier `supabase_schema.sql` dans l'éditeur SQL de Supabase.
