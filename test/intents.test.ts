import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readIntentFlags } from '../src/intents.js';

describe('privileged intents', () => {
    it('requests message content unless that flag is turned off', () => {
        assert.equal(readIntentFlags({}).messageContent, true);
        assert.equal(readIntentFlags({ ENABLE_MESSAGE_CONTENT_INTENT: 'true' }).messageContent, true);
        assert.equal(readIntentFlags({ ENABLE_MESSAGE_CONTENT_INTENT: 'false' }).messageContent, false);
        assert.equal(readIntentFlags({}).guildMembers, false);
    });
});
