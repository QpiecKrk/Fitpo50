'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function normalizedOptions(options) {
  if (typeof options === 'string') return { encoding: options };
  return options && typeof options === 'object' ? { ...options } : {};
}

function temporaryPath(file) {
  return path.join(
    path.dirname(file),
    `.${path.basename(file)}.writing-${process.pid}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`,
  );
}

function atomicWriteFileSync(file, data, options = {}) {
  const target = path.resolve(file);
  const settings = normalizedOptions(options);
  const hooks = settings.atomicHooks || {};
  delete settings.atomicHooks;
  const exclusive = ['wx', 'ax', 'wx+', 'ax+'].includes(String(settings.flag || ''));
  delete settings.flag;
  if (settings.mode === undefined && fs.existsSync(target)) settings.mode = fs.statSync(target).mode & 0o777;
  const temporary = temporaryPath(target);
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, 'wx', settings.mode);
    const buffer = Buffer.isBuffer(data)
      ? data
      : Buffer.from(String(data), settings.encoding || 'utf8');
    let offset = 0;
    while (offset < buffer.length) offset += fs.writeSync(descriptor, buffer, offset, buffer.length - offset);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    if (typeof hooks.beforeCommit === 'function') hooks.beforeCommit({ temporary, target });
    if (exclusive) {
      // A hard-link publish preserves O_EXCL semantics; rename would overwrite an active lock.
      fs.linkSync(temporary, target);
      fs.unlinkSync(temporary);
    } else {
      fs.renameSync(temporary, target);
    }
  } catch (error) {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch (_closeError) { /* best effort */ }
    }
    try { fs.unlinkSync(temporary); } catch (_unlinkError) { /* best effort */ }
    throw error;
  }
}

function atomicWriteJsonSync(file, payload, options = {}) {
  atomicWriteFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', ...options });
}

module.exports = { atomicWriteFileSync, atomicWriteJsonSync };
