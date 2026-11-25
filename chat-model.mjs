import {outsideParty, isPlayerCharacter} from './model.mjs';

const fail = (status, message) => { throw Object.assign(new Error(message), {status}); };
const object = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const normalizeActor = name => String(name || '').trim().toLocaleLowerCase('pt-BR');

export const chatChannels = Object.freeze({
  public: 'Mesa',
  ic: 'Em personagem',
  whisper: 'Sussurro'
});

export const chatTextLimit = 400;
export const chatSpeakerLimit = 60;
export const chatRetention = Object.freeze({shared: 60, whisper: 40});

function viewerFor(state, access) {
  if (!access?.memberId || access.guest || access.master) return null;
  return (state.characters || []).find(
    character => !character.hidden && isPlayerCharacter(character) && character.ownerId === access.memberId
  ) || null;
}

export function mutateChat(state, action, data, access) {
  if (action !== 'chatSend') return false;
  if (!access?.master) {
    if (access?.guest) fail(403, 'Entre na campanha e escolha um personagem.');
  }
  const own = viewerFor(state, access);
  if (!access?.master && !own) fail(403, 'Escolha ou crie seu personagem para entrar na mesa.');

  const text = typeof data?.text === 'string' ? data.text.trim() : '';
  if (!text || text.length > chatTextLimit) {
    fail(400, 'Escreva uma mensagem de 1 a ' + chatTextLimit + ' caracteres.');
  }

  const channel = data?.channel === undefined ? 'public' : data.channel;
  if (!Object.hasOwn(chatChannels, channel)) {
    fail(400, 'Canal de mensagem inválido.');
  }

  let actor = 'Mestre';
  let senderCharacterId = '';
  let speakerCharacterId = '';

  if (!access.master) {
    senderCharacterId = own.id;
    actor = own.name;
  } else if (channel === 'ic') {
    const requestedSpeakerId = typeof data?.speakerCharacterId === 'string' ? data.speakerCharacterId.trim() : '';
    const customSpeaker = typeof (data?.speaker ?? data?.actor) === 'string' ? (data.speaker ?? data.actor).trim() : '';
    if (requestedSpeakerId) {
      const speaker = (state.characters || []).find(character => character.id === requestedSpeakerId);
      if (!speaker) fail(404, 'Personagem indisponível para falar.');
      speakerCharacterId = speaker.id;
      actor = speaker.name;
    } else if (customSpeaker) {
      actor = customSpeaker.slice(0, chatSpeakerLimit);
    }
  }

  let targetRole = '';
  let targetCharacterId = '';
  let targetName = '';

  if (channel === 'whisper') {
    const rawTarget = typeof data?.targetId === 'string' ? data.targetId.trim() : '';
    if (access.master) {
      if (!rawTarget || rawTarget === 'gm') fail(400, 'Escolha um personagem destinatário para o sussurro.');
      const target = (state.characters || []).find(
        character => character.id === rawTarget && !character.hidden && isPlayerCharacter(character)
      );
      if (!target) fail(400, 'Destinatário inválido para o sussurro.');
      targetRole = 'player';
      targetCharacterId = target.id;
      targetName = target.name;
    } else if (!rawTarget || rawTarget === 'gm') {
      targetRole = 'gm';
      targetName = 'Mestre';
    } else {
      const target = (state.characters || []).find(character => character.id === rawTarget);
      if (!target || target.id === own.id || target.hidden || !isPlayerCharacter(target) || outsideParty(target, own)) {
        fail(400, 'Destinatário inválido para o sussurro.');
      }
      targetRole = 'player';
      targetCharacterId = target.id;
      targetName = target.name;
    }
  }

  const message = {
    id: crypto.randomUUID(),
    at: Date.now(),
    channel,
    fromRole: access.master ? 'master' : 'player',
    actor,
    text,
    ...(senderCharacterId ? {senderCharacterId} : {}),
    ...(speakerCharacterId ? {speakerCharacterId} : {}),
    ...(targetRole ? {targetRole, targetName} : {}),
    ...(targetCharacterId ? {targetCharacterId} : {})
  };

  const counts = {shared: 0, whisper: 0};
  state.messages = [message, ...(state.messages || [])].filter(item => {
    const bucket = item?.channel === 'whisper' ? 'whisper' : 'shared';
    return ++counts[bucket] <= chatRetention[bucket];
  });
  return true;
}

export function messageView(state, access, viewer = viewerFor(state, access)) {
  const messages = state.messages || [];
  if (access?.master) return messages.map(msg => ({...msg}));
  const hidden = (state.characters || []).filter(character => character.hidden || outsideParty(character, viewer));
  const ids = new Set(hidden.map(c => c.id));
  const names = new Set(hidden.map(c => normalizeActor(c.name)).filter(Boolean));
  return messages.filter(msg => {
    if (!msg || !Object.hasOwn(chatChannels, msg.channel)) return false;
    if (msg.channel === 'whisper') {
      if (access?.guest || !viewer) return false;
      return msg.senderCharacterId === viewer.id || msg.targetCharacterId === viewer.id;
    }
    const authorId = msg.senderCharacterId || msg.speakerCharacterId || '';
    if (authorId ? ids.has(authorId) : names.has(normalizeActor(msg.actor))) return false;
    return true;
  }).map(msg => ({...msg}));
}

export function messageVersion(messages = []) {
  let hash = 2166136261;
  for (const msg of messages) {
    for (const char of String(msg?.id || '')) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
  }
  return messages.length + '-' + (hash >>> 0).toString(36);
}

export function validateMessages(messages) {
  if (messages === undefined) return;
  if (!Array.isArray(messages) || messages.length > chatRetention.shared + chatRetention.whisper) {
    fail(400, 'Histórico de mensagens inválido no backup.');
  }
  const ids = new Set();
  for (const msg of messages) {
    if (
      !object(msg) ||
      typeof msg.id !== 'string' || !msg.id || ids.has(msg.id) ||
      !Object.hasOwn(chatChannels, msg.channel) ||
      !['master', 'player'].includes(msg.fromRole) ||
      typeof msg.actor !== 'string' || !msg.actor.trim() || msg.actor.length > 80 ||
      typeof msg.text !== 'string' || !msg.text.trim() || msg.text.length > chatTextLimit ||
      !Number.isFinite(msg.at)
    ) {
      fail(400, 'Mensagem inválida no backup.');
    }
    if (msg.senderCharacterId !== undefined && (typeof msg.senderCharacterId !== 'string' || msg.senderCharacterId.length > 80)) {
      fail(400, 'Remetente de mensagem inválido no backup.');
    }
    if (msg.speakerCharacterId !== undefined && (typeof msg.speakerCharacterId !== 'string' || msg.speakerCharacterId.length > 80)) {
      fail(400, 'Locutor de mensagem inválido no backup.');
    }
    if (msg.targetRole !== undefined && !['gm', 'player'].includes(msg.targetRole)) {
      fail(400, 'Destinatário de mensagem inválido no backup.');
    }
    if (msg.targetCharacterId !== undefined && (typeof msg.targetCharacterId !== 'string' || msg.targetCharacterId.length > 80)) {
      fail(400, 'Destinatário de mensagem inválido no backup.');
    }
    if (msg.targetName !== undefined && (typeof msg.targetName !== 'string' || msg.targetName.length > 80)) {
      fail(400, 'Destinatário de mensagem inválido no backup.');
    }
    ids.add(msg.id);
  }
}
