const crypto = require('crypto');

class AnimecixSigner {
    constructor() {
        this.k1 = "FLzCbDlsJ";
        this.k2 = [106, 117, 107, 102, 56, 71, 53, 56, 98];
        this.PA = "i4C7R2";
    }

    async encryptSymmetric(e, n) {
        const iv = crypto.randomBytes(12);
        const keyBuf = Buffer.from(n, 'base64');
        const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);
        const enc = Buffer.concat([cipher.update(Buffer.from(e, 'utf-8')), cipher.final()]);
        const tag = cipher.getAuthTag();
        return {
            ciphertext: Buffer.concat([enc, tag]).toString('base64'),
            iv: iv.toString('base64')
        };
    }

    async getHeader(urlPath = '', prefix = 'X', salt = this.PA + 'fXGocdYg') {
        const h = urlPath && urlPath.split('?').length > 1 ? urlPath.split('?')[1] : '';
        const key = Buffer.from(salt + this.k1 + this.k2.map(c => String.fromCharCode(c)).join('')).toString('base64');
        const enc = await this.encryptSymmetric('{version}' + h, key);
        return { [`${prefix}-E-H`]: `${enc.ciphertext}.${enc.iv}` };
    }
}

const signer = new AnimecixSigner();

module.exports = {
    AnimecixSigner,
    signer
};
