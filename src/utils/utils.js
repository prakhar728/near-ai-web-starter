export const sanitizeAuthObject = (authObject) => {
    authObject.signature = signedMessage.signature;
    authObject.account_id = signedMessage.accountId;
    authObject.public_key = signedMessage.publicKey;

    return authObject;
}