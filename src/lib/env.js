// Verification des variables d'environnement au demarrage.
//
// Un token invalide se manifeste sinon par un "TokenInvalid" brut de discord.js,
// qui ne dit pas *pourquoi*. On verifie ici les erreurs de copier-coller les plus
// frequentes : guillemets, espaces, caractere en trop, et incoherence entre le
// token et le CLIENT_ID (deux applications Discord differentes).

const ID_PATTERN = /^\d{17,20}$/;

// Un token Discord = base64(application_id).timestamp.signature
function decodeTokenAppId(token) {
  const first = token.split('.')[0];
  if (!first) return null;
  try {
    const decoded = Buffer.from(first, 'base64').toString('utf8');
    return ID_PATTERN.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

// Nettoie une valeur collee depuis le portail Discord ou l'UI d'un hebergeur.
function clean(raw) {
  if (raw == null) return { value: null, notes: [] };
  const notes = [];
  let v = raw;

  if (v !== v.trim()) {
    notes.push('des espaces entouraient la valeur');
    v = v.trim();
  }
  if (/^["'].*["']$/.test(v)) {
    notes.push('la valeur était entourée de guillemets');
    v = v.slice(1, -1).trim();
  }
  if (v.startsWith('﻿')) {
    notes.push('la valeur commençait par un BOM');
    v = v.slice(1);
  }
  return { value: v, notes };
}

/**
 * Valide DISCORD_TOKEN et, si présents, CLIENT_ID / GUILD_ID.
 * Renvoie { token, clientId, guildId, problems[], warnings[] }.
 * Les valeurs nettoyées sont réécrites dans process.env.
 */
export function checkEnv({ requireIds = false } = {}) {
  const problems = [];
  const warnings = [];

  const token = clean(process.env.DISCORD_TOKEN);
  const clientId = clean(process.env.CLIENT_ID);
  const guildId = clean(process.env.GUILD_ID);

  for (const [key, res] of [['DISCORD_TOKEN', token], ['CLIENT_ID', clientId], ['GUILD_ID', guildId]]) {
    for (const note of res.notes) warnings.push(`${key} : ${note} (corrigé automatiquement).`);
    if (res.value) process.env[key] = res.value;
  }

  // --- token ---
  if (!token.value) {
    problems.push('DISCORD_TOKEN est absent. Renseigne-le dans .env (local) ou dans les variables de ton hébergeur.');
  } else {
    const segments = token.value.split('.');
    const appId = decodeTokenAppId(token.value);

    if (segments.length !== 3) {
      problems.push(
        `DISCORD_TOKEN mal formé : ${segments.length} segment(s) au lieu de 3. ` +
          'Un token ressemble à "XXXX.YYYY.ZZZZ". Recopie-le depuis Discord Developer Portal → Bot → Reset Token.',
      );
    } else if (!appId) {
      // Cas le plus courant : un caractere parasite en tete de chaine.
      const retry = decodeTokenAppId(token.value.slice(1));
      problems.push(
        retry
          ? `DISCORD_TOKEN a un caractère en trop au début ("${token.value[0]}"). ` +
            'Le reste du token est valide : retire ce premier caractère, ou recopie le token proprement.'
          : 'DISCORD_TOKEN illisible : son premier segment ne décode pas en identifiant d application. ' +
            'Fais Discord Developer Portal → Bot → Reset Token et recopie la valeur entière.',
      );
    } else if (clientId.value && ID_PATTERN.test(clientId.value) && appId !== clientId.value) {
      // Token et CLIENT_ID issus de deux applications differentes : les commandes
      // seraient enregistrees sur l'une et le bot connecte sur l'autre.
      problems.push(
        `DISCORD_TOKEN et CLIENT_ID appartiennent à deux applications différentes ` +
          `(token → ${appId}, CLIENT_ID → ${clientId.value}). ` +
          'Reprends les deux valeurs dans la MÊME application, sur Discord Developer Portal.',
      );
    }
  }

  // --- identifiants ---
  for (const [key, res] of [['CLIENT_ID', clientId], ['GUILD_ID', guildId]]) {
    if (!res.value) {
      if (requireIds) problems.push(`${key} est absent.`);
      continue;
    }
    if (!ID_PATTERN.test(res.value)) {
      problems.push(
        `${key} n est pas un identifiant Discord valide (17 à 20 chiffres attendus, reçu ${res.value.length} caractère(s)). ` +
          (key === 'CLIENT_ID'
            ? 'Developer Portal → General Information → Application ID.'
            : 'Clic droit sur ton serveur → Copier l identifiant (mode développeur activé).'),
      );
    }
  }

  return { token: token.value, clientId: clientId.value, guildId: guildId.value, problems, warnings };
}

/**
 * Interroge Discord pour distinguer un token *périmé* (bien formé mais révoqué
 * par un Reset Token) d'un token malformé. discord.js renvoie "TokenInvalid"
 * dans les deux cas, ce qui n'aide pas à choisir quoi corriger.
 * Ne bloque jamais le démarrage : en cas de panne réseau, on laisse le login décider.
 */
export async function verifyTokenOnline(token) {
  try {
    const res = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bot ${token}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      const user = await res.json();
      return { ok: true, tag: user.username, id: user.id };
    }
    if (res.status === 401) {
      return {
        ok: false,
        reason:
          'Discord a refusé ce token (401). Il est bien formé mais n est plus actif : ' +
          'un « Reset Token » plus récent l a invalidé. Recopie la valeur affichée après le DERNIER reset, ' +
          'et reporte-la partout (local et hébergeur) avant d en générer un nouveau.',
      };
    }
    return { ok: false, reason: `Discord a répondu ${res.status} à la vérification du token.` };
  } catch {
    return { ok: null };
  }
}

// Affiche le diagnostic et coupe le processus si la configuration est inutilisable.
export function assertEnv(options) {
  const result = checkEnv(options);

  for (const w of result.warnings) console.warn(`⚠️  ${w}`);

  if (result.problems.length) {
    console.error('\n❌ Configuration invalide, le bot ne peut pas démarrer :\n');
    for (const p of result.problems) console.error(`   • ${p}`);
    console.error('\n   Rappel : token et CLIENT_ID doivent provenir de la même application Discord.');
    console.error('   https://discord.com/developers/applications\n');
    process.exit(1);
  }

  return result;
}
