(function(ns) {

  var expect = chai.expect;

  describe('join()', function() {
    it('should hanle 1 table', function() {
      // TODO
    });

    it('should combine 2 tables', function() {
      var t1 = [
        { a1: 0, a2: 1, a3: 2 }
      ];
      var t2 = [
        { b1: 0, b2: 1, b3: 2 },
        { b1: 3, b2: 4, b3: 5 }
      ];
      var expectedResult = [
        { a1: 0, a2: 1, a3: 2, b1: 0, b2: 1, b3: 2 },
        { a1: 0, a2: 1, a3: 2, b1: 3, b2: 4, b3: 5 }
      ];

      var result = WDCSchema.join(t1, t2);

      expect(result).to.deep.equal(expectedResult);
    });

    it('should combine 2+ tables', function() {
      // TODO
    });
  });

  describe('convertToTableHeaders()', function() {
    // TODO: Separate out for different types

    it('should take a schema and output headers', function() {
      var schema = [
        { name: 'stringKey', type: 'string' },
        { name: 'stringArrayKey', type: 'array', arrayType: 'string' },
        {
          name: 'objectArrayKey', type: 'array', arrayType: 'object',
          subFields: [
            { name: 'intKey', type: 'int' },
            { name: 'floatKey', type: 'float' }
          ]
        },
        {
          name: 'objectKey', type: 'object',
          subFields: [
            {name: 'boolKey', type: 'bool'}
          ]
        }
      ];

      var expectedHeaders = {
        'stringKey': 'string',
        'stringArrayKey[]': 'string',
        'objectArrayKey[].intKey': 'int',
        'objectArrayKey[].floatKey': 'float',
        'objectKey.boolKey': 'bool'
      };

      var headers = WDCSchema.convertToTableHeaders(schema);

      expect(headers).to.deep.equal(expectedHeaders);
    });
  });

  describe('convertToTable()', function() {
    // TODO: Separate out for different types
    it('should take json and a schema and output headers', function() {
      var json = [
        //$mark-jeziTheCat: aassssssssssssss5444444444444sssss
        {
          'stringKey': '0',
          'stringArrayKey': ['1', '2'],
          'objectArrayKey': [
            {
              'intKey': 3,
              'floatKey': 4.5
            }
          ],
          objectKey: {
            boolKey: true
          }
        },
        {
          'stringKey': '10',
          'stringArrayKey': ['11'],
          'objectArrayKey': [
            {
              'intKey': 13,
              'floatKey': 14.15
            },
            {
              'intKey': 16,
              'floatKey': 17.18
            }
          ],
          objectKey: {
            boolKey: false
          }
        }
      ];

      var schema = [
        { name: 'stringKey', type: 'string' },
        { name: 'stringArrayKey', type: 'array', arrayType: 'string' },
        {
          name: 'objectArrayKey', type: 'array', arrayType: 'object',
          subFields: [
            { name: 'intKey', type: 'int' },
            { name: 'floatKey', type: 'float' }
          ]
        },
        {
          name: 'objectKey', type: 'object',
          subFields: [
            {name: 'boolKey', type: 'bool'}
          ]
        }
      ];

      var expectedTable = [
        {
          'stringKey': '0',
          'stringArrayKey[]': '1',
          'objectArrayKey[].intKey': 3,
          'objectArrayKey[].floatKey': 4.5,
          'objectKey.boolKey': true
        },
        {
          'stringKey': '0',
          'stringArrayKey[]': '2',
          'objectArrayKey[].intKey': 3,
          'objectArrayKey[].floatKey': 4.5,
          'objectKey.boolKey': true
        },
        {
          'stringKey': '10',
          'stringArrayKey[]': '11',
          'objectArrayKey[].intKey': 13,
          'objectArrayKey[].floatKey': 14.15,
          'objectKey.boolKey': false
        },
        {
          'stringKey': '10',
          'stringArrayKey[]': '11',
          'objectArrayKey[].intKey': 16,
          'objectArrayKey[].floatKey': 17.18,
          'objectKey.boolKey': false
        }
      ];

      var resultTable = WDCSchema.convertToTable(json, schema);

      expect(resultTable).to.deep.equal(expectedTable);
    });

    //TODO: Split this test out
    it('should output fields even if it does not exist in json but not if there are empty subFields in the schema', function() {
      var json = [{}, {}];
      var schema = [
        { name: 'stringKey', type: 'string' },
        { name: 'objectKey', type: 'object', subFields: [ ] },
        { name: 'arrayKey', type: 'array', arrayType: 'object', subFields: [ ] }
      ];

      var expectedTable = [
        { stringKey: null },
        { stringKey: null }
      ];

      var resultTable = WDCSchema.convertToTable(json, schema);

      expect(resultTable).to.deep.equal(expectedTable);
    });
  });

})(window);