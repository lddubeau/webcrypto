/**
 * Package dependencies
 */
const crypto = require('crypto')
const base64url = require('base64url') 
const {TextEncoder, TextDecoder} = require('text-encoding')

/**
 * Local dependencies
 */
const KeyAlgorithm = require('../dictionaries/KeyAlgorithm')
const AesKeyAlgorithm = require('../dictionaries/AesKeyAlgorithm') 
const Algorithm = require ('../algorithms/Algorithm')
const CryptoKey = require('../keys/CryptoKey')
const JsonWebKey = require('../keys/JsonWebKey')


/**
 * Errors
 */
const {
  DataError,
  OperationError,
  InvalidAccessError,
  KeyFormatNotSupportedError
} = require('../errors')

/**
 * AES-KW
 */
class AES_KW extends Algorithm {

    /**
     * dictionaries
     */
    static get dictionaries () {
      return [
        KeyAlgorithm,
        AesKeyAlgorithm
      ]
    }

    /**
     * members
     */
    static get members () {
      return {
        name: String,
        modulusLength: Number,
        publicExponent: 'BufferSource'
      }
    }

    /**
     * wrapKey
     *
     * @description
     *
     * @param {string} format
     * @param {CryptoKey} key
     * @param {CryptoKey} wrappingKey
     * @param {KeyAlgorithm} wrappingAlgorithm
     *
     * @returns {Array}
     */
    wrapKey (format, key, wrappingKey, wrappingAlgorithm) {
      
    }

    /**
     * unwrapKey
     *
     * @description
     *
     * @param {KeyFormat} format
     * @param {BufferSource} wrappedKey
     * @param {CryptoKey} unwrappingKey
     * @param {AlgorithmIdentifier} unwrapAlgorithm
     * @param {AlgorithmIdentifier} unwrappedKeyAlgorithm
     * @param {Boolean} extractable
     * @param {Array} keyUsages
     *
     * @returns {Array}
     */
    unwrapKey (format, wrappedKey, unwrappingKey, unwrapAlgorithm, unwrappedKeyAlgorithm, extractable, keyUsages) {
      
    }

    /**
     * generateKey
     *
     * @description
     * Generate an AES-KW key pair
     *
     * @param {AesKwParams} params
     * @returns {CryptoKeyPair}
     */
    generateKey (params, extractable, usages) {
      // 1. Validate usages
      usages.forEach(usage => {
        if (usage !== 'wrapKey' && usage !== 'unwrapKey') {
          throw new SyntaxError('Key usages can only include "wrapKey" or "unwrapKey"')
        }
      })
      
      // 2. Validate length
      if (![128,192,256].includes(params.length)) {
          throw new OperationError('Member length must be 128, 192, or 256.')
      }

      // 3. Generate AES Key
      let symmetricKey
      try {
        symmetricKey = crypto.randomBytes(params.length/8)
      // 4. Validate key generation
      } catch (error) {
        throw new OperationError(error.message)
      }
      
      // 6. Set new AesKeyAlgorithm
      let algorithm = new AES_KW(params)

      // 5. Define new CryptoKey names key
      let key = new CryptoKey({
        type: 'secret',
        algorithm,
        extractable,
        usages,
        handle: symmetricKey
      })

      // 12. Return Key
      return key
  }

    /**
     * importKey
     *
     * @description
     *
     * @param {string} format
     * @param {string|JsonWebKey} keyData
     * @param {KeyAlgorithm} algorithm
     * @param {Boolean} extractable
     * @param {Array} keyUsages
     *
     * @returns {CryptoKey}
     */
    importKey (format, keyData, algorithm, extractable, keyUsages) {
      let data, jwk
      
      // 1. Validate keyUsages
      keyUsages.forEach(usage => {
        if (usage !== 'wrapKey' 
         && usage !== 'unwrapKey') {
           throw new SyntaxError('Key usages can only include "wrapKey" or "unwrapKey"')
        }
      })

      // 2.1 "raw" format
      if (format === 'raw'){
          // 2.1.1 Let data be the octet string contained in keyData
          data = Buffer.from(keyData)

          // 2.1.2 Ensure data length is 128, 192 or 256
          if (![16,24,32].includes(data.length)){
            throw new DataError('Length of data bits must be 128, 192 or 256.')
          }
      }

      // 2.2 "jwk" format
      else if (format === 'jwk'){
        // 2.2.1 Ensure data is JsonWebKey dictionary 
        if (typeof keyData === 'object' && !Array.isArray(keyData)){
          jwk = new JsonWebKey(keyData)
        } else {
          throw new DataError('Invalid jwk format')
        }
        
        // 2.2.2 Validate "kty" field heuristic
        if (jwk.kty !== "oct"){
          throw new DataError('kty property must be "oct"')
        }
        
        // 2.2.3 Ensure jwk meets these requirements: 
        // https://tools.ietf.org/html/rfc7518#section-6.4 
        if (!jwk.k){
          throw new DataError('k property must not be empty')
        }
        
        // 2.2.4 Assign data 
        data = base64url.toBuffer(jwk.k)
        
        // 2.2.5 Validate data lengths
        if (data.length === 16) {
          if (jwk.alg && jwk.alg !== 'A128KW'){
            throw new DataError('Algorithm "A128KW" must be 128 bits in length')
          }
        } else if (data.length === 24) {
          if (jwk.alg && jwk.alg !== 'A192KW'){
            throw new DataError('Algorithm "A192KW" must be 192 bits in length')
          }
        } else if (data.length === 32) {
          if (jwk.alg && jwk.alg !== 'A256KW'){
            throw new DataError('Algorithm "A256KW" must be 256 bits in length')
          }
        } else {
          throw new DataError('Algorithm and data length mismatch')
        }
       
        // 2.2.6 Validate "use" field
        if (keyUsages && jwk.use && jwk.use !== 'enc'){
          throw new DataError('Key use must be "enc"')
        }
        
        // 2.2.7 Validate "key_ops" field
        if (jwk.key_ops){
          jwk.key_ops.forEach(op => {
            if (op !== 'encrypt' 
             && op !== 'decrypt' 
             && op !== 'wrapKey' 
             && op !== 'unwrapKey') {
              throw new DataError('Key operation can only include "encrypt", "decrypt", "wrapKey" or "unwrapKey"')
            }
          })
        }
        
        // 2.2.8 validate "ext" field
        if (jwk.ext === false && extractable === true){
          throw new DataError('Cannot be extractable when "ext" is set to false')
        }
      }
      
      // 2.3 Otherwise...
      else {
        throw new KeyFormatNotSupportedError(format)
      }
      
      // 3. Generate new key
      let key = new CryptoKey({
            type: 'secret',
            extractable,
            usages: keyUsages,
            handle: data 
        })
      
      // 4-6. Generate algorithm
      let aesAlgorithm = new AES_KW(
        { name: 'AES-KW',
          length: data.length * 8
        })
      
      // 7. Set algorithm to internal algorithm property of key
      key.algorithm = aesAlgorithm
      
      // 8. Return key
      return key
  }

  /**
   * exportKey
   *
   * @description
   *
   * @param {string} format
   * @param {CryptoKey} key
   *
   * @returns {*}
   */
  exportKey (format, key) {
      let result, data

      // 1. Validate handle slot
      if (!key.handle) {
        throw new OperationError('Missing key material')
      }
      
      // 2.1 "raw" format
      if (format === 'raw'){
          // 2.1.1 Let data be the raw octets of the key
          data = key.handle 
          // 2.1.2 Let result be containing data
          result = Buffer.from(data) 
      }
      
      // 2.2 "jwk" format
      else if (format === 'jwk'){
        // 2.2.1 Validate JsonWebKey
        let jwk = new JsonWebKey()
        
        // 2.2.2 Set kty property 
        jwk.kty = 'oct'
        
        // 2.2.3 Set k property
        jwk.k = base64url(key.handle)
        data = key.handle 
        
        // 2.2.4 Validate length 
        if (data.length === 16) {
            jwk.alg = 'A128KW'
        } else if (data.length === 24) {
            jwk.alg = 'A192KW'
        } else if (data.length === 32) {
            jwk.alg = 'A256KW'
        }
        // 2.2.5 Set keyops property 
        jwk.key_ops = key.usages 

        // 2.2.6 Set ext property 
        jwk.ext = key.extractable
        
        // 2.2.7 Set result to the result of converting jwk to an ECMAScript object
        result = jwk
      }
      
      // 2.3 Otherwise...
      else {
        throw new KeyFormatNotSupportedError(format)
      }

      // 3. Return result
      return result
  }
}

/**
 * Export
 */
module.exports = AES_KW

let aes = new AES_KW({name: "AES-KW"})
let key = aes.generateKey({
        name: "AES-KW",
        length: 256, //can be  128, 192, or 256
    },
    true, //whether the key is extractable (i.e. can be used in exportKey)
    ["wrapKey", "unwrapKey"] )

console.log("key",key)

let imp = aes.importKey(
  "jwk", //can be "jwk" or "raw"
    {   //this is an example jwk key, "raw" would be an ArrayBuffer
        kty: "oct",
        k: "Y0zt37HgOx-BY7SQjYVmrqhPkO44Ii2Jcb9yydUDPfE",
        alg: "A256KW",
        ext: true,
    },
    {   //this is the algorithm options
        name: "AES-KW",
    },
    false, //whether the key is extractable (i.e. can be used in exportKey)
    ["wrapKey", "unwrapKey"])

  console.log("imp",imp)

  let exp = aes.exportKey(
    "jwk", //can be "jwk" or "raw"
    key //extractable must be true
  )

  console.log("exp",exp)
