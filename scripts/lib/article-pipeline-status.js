'use strict';

const fs = require('node:fs');
const { atomicWriteFileSync } = require('./atomic-file');
const path = require('node:path');
const { warsawIso } = require('./time');

const EXIT_CODES = Object.freeze({
  SUCCESS: 0,
  AWAITING_REVIEW: 10,
  CONTENT_BLOCKED: 20,
  ENVIRONMENT_FAILURE: 30,
});

class PipelineFailure extends Error {
  constructor(message, status = 'ENVIRONMENT_FAILURE', code = 'PIPELINE_ENVIRONMENT') {
    super(message);
    this.name = 'PipelineFailure';
    this.pipelineStatus = status;
    this.pipelineCode = code;
  }
}

function contentBlocked(message, code = 'CONTENT_CONTRACT') {
  return new PipelineFailure(message, 'CONTENT_BLOCKED', code);
}

function environmentFailure(message, code = 'ENVIRONMENT_RUNTIME') {
  return new PipelineFailure(message, 'ENVIRONMENT_FAILURE', code);
}

function statusPath(root, slug) {
  return path.join(root, 'data', 'reports', 'local', 'article-pipeline', `${slug}.status.json`);
}

function writePipelineStatus(root, slug, status, details = {}) {
  const file = statusPath(root, slug);
  const payload = {
    version: 1,
    slug,
    status,
    exit_code: EXIT_CODES[status] ?? EXIT_CODES.ENVIRONMENT_FAILURE,
    updated_at: warsawIso(),
    ...details,
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  atomicWriteFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
  console.log(`[PIPELINE_STATUS] ${status} exit=${payload.exit_code} report=${file}`);
  if (payload.next_action) console.log(`[NEXT_ACTION] ${payload.next_action}`);
  if (payload.next_args) console.log(`[NEXT_ARGS] ${JSON.stringify(payload.next_args)}`);
  return { file, payload };
}

function classifyPipelineFailure(error) {
  const status = error?.pipelineStatus === 'CONTENT_BLOCKED' ? 'CONTENT_BLOCKED' : 'ENVIRONMENT_FAILURE';
  return status === 'CONTENT_BLOCKED'
    ? { status, code: error?.pipelineCode || 'CONTENT_CONTRACT', exitCode: EXIT_CODES.CONTENT_BLOCKED, nextAction: 'FIX_CONTENT_OR_PACKAGE' }
    : { status, code: error?.pipelineCode || 'ENVIRONMENT_RUNTIME', exitCode: EXIT_CODES.ENVIRONMENT_FAILURE, nextAction: 'FIX_ENVIRONMENT_AND_RETRY' };
}

module.exports = {
  EXIT_CODES,
  PipelineFailure,
  classifyPipelineFailure,
  contentBlocked,
  environmentFailure,
  statusPath,
  writePipelineStatus,
};
