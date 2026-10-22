import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    httpsUrl,
    imageKindForAction,
    readImageUrl,
    resolveImage,
    type FoundImage,
} from '../src/images/resolve-image.js';

const nekoImage: FoundImage = {
    url: 'https://nekos.best/api/v2/neko/example.png',
    source: 'neko',
    credit: 'Example Artist',
    fellBack: false,
};

describe('image sources', () => {
    it('accepts only https image urls', () => {
        assert.equal(httpsUrl('http://example.com/a.png'), null);
        assert.equal(httpsUrl('javascript:alert(1)'), null);
        assert.equal(httpsUrl('https://gamearoo.top/ram-api-img/hug5.gif'), 'https://gamearoo.top/ram-api-img/hug5.gif');
        assert.equal(readImageUrl({ url: 'https://gamearoo.top/ram-api-img/hug5.gif' })?.includes('hug5.gif'), true);
        assert.equal(readImageUrl({ image: 'https://example.com/cat.png' }), 'https://example.com/cat.png');
        assert.equal(readImageUrl({ url: 'not a url' }), null);
    });

    it('uses Ram API for hug and a neko when that API has no picture', async () => {
        assert.equal(imageKindForAction('hug'), 'hug');
        assert.equal(imageKindForAction('pat'), 'neko');
        assert.equal(imageKindForAction('wave'), 'neko');

        let ramCalls = 0;
        const fromRam = await resolveImage('hug', {
            ram: async () => {
                ramCalls += 1;
                return 'https://gamearoo.top/ram-api-img/hug5.gif';
            },
            neko: async () => nekoImage,
        });
        assert.equal(fromRam?.source, 'ram');
        assert.equal(fromRam?.fellBack, false);
        assert.equal(ramCalls, 1);

        const missed = await resolveImage('meme', {
            ram: async () => null,
            neko: async () => nekoImage,
        });
        assert.equal(missed?.source, 'neko');
        assert.equal(missed?.fellBack, true);
        assert.equal(missed?.credit, 'Example Artist');

        let ramUsed = false;
        const direct = await resolveImage('neko', {
            ram: async () => {
                ramUsed = true;
                return 'https://example.com/nope.png';
            },
            neko: async () => nekoImage,
        });
        assert.equal(direct?.source, 'neko');
        assert.equal(direct?.fellBack, false);
        assert.equal(ramUsed, false);
    });
});
