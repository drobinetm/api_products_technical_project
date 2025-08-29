import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, removeAdditional: 'all' });
addFormats(ajv);

const productInputSchema = {
    type: 'object',
    required: ['gs1Id', 'name'],
    additionalProperties: false,
    properties: {
        gs1Id: { type: 'string', minLength: 3 },
        name: { type: 'string', minLength: 1 },
        description: { type: 'string' },
        brand: { type: 'string' },
        manufacturer: { type: 'string' },
        netWeight: { type: 'string' }
    }
};

export const validateProductInput = ajv.compile(productInputSchema);

export function assertValid(schemaValidator, data) {
    const valid = schemaValidator(data);
    if (!valid) {
        const msg = schemaValidator.errors?.map(e => `${e.instancePath || 'field'} ${e.message}`).join('; ');
        const err = new Error(`ValidationError: ${msg}`);
        err.statusCode = 400;
        throw err;
    }
}