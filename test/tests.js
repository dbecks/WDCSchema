(function(ns) {

  var expect = chai.expect;

  describe('join()', function() {
    it('should handle 1 table', function() {
      var t1 = [
        { a1: 0, a2: 1, a3: 2 }
      ];
      var expectedResult = [
        { a1: 0, a2: 1, a3: 2 }
      ];

      var result = WDCSchema.join(t1);

      expect(result).to.deep.equal(expectedResult);
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

    describe('combining 2+ tables', function() {
      var t1 = [
        { a1: 0 }
      ];
      var t2 = [
        { a2: 1 }
      ];
      var t3 = [
        { a3: 2 }
      ];
      var expectedResult = [
        { a1: 0, a2: 1, a3: 2 }
      ];

      it('should work with multiple arguments', function() {
        var result = WDCSchema.join(t1, t2, t3);

        expect(result).to.deep.equal(expectedResult);
      });

      it('should work for join.multiple() for passing an array of tables', function() {
        var result = WDCSchema.join.multiple([t1, t2, t3]);

        expect(result).to.deep.equal(expectedResult);
      });
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

    // Needed because underscore will treat objects with a "length" field as "array-like"
    it('should work for objects with a "length" key', function() {
      var json = [
        { objectKey: { stringKey: 'a', length: 1 } },
        { objectKey: { } }
      ];
      var schema = [
        { name: 'objectKey', type: 'object',
          subFields: [
            { name: 'stringKey', type: 'string' },
            { name: 'length', type: 'int' }
          ]
        }
      ];

      var expectedTable = [
        { 'objectKey.stringKey': 'a',  'objectKey.length': 1 },
        { 'objectKey.stringKey': null, 'objectKey.length': null }
      ];

      var resultTable = WDCSchema.convertToTable(json, schema);

      expect(resultTable).to.deep.equal(expectedTable);
    });
  });

  describe('generateSchema()', function() {
    it('should estimate for string type', function () {
      var json = [ { stringKey: 'a' }, { stringKey: 'b' }, { stringKey: 'c' }, { } ];
      
      var schema = WDCSchema.generateSchema(json, json.length);

      expect(schema).to.deep.equal([ { name: 'stringKey', type: 'string' } ]);
    });

    it('should estimate for bool type', function () {
      var json = [ { boolKey: true }, { boolKey: false }, { boolKey: true }, { } ];

      var schema = WDCSchema.generateSchema(json, json.length);

      expect(schema).to.deep.equal([ { name: 'boolKey', type: 'bool' } ]);
    });
    
    it('should estimate for int type', function () {
      var json = [ { intKey: 1 }, { intKey: 2 }, { intKey: 3 }, { } ];

      var schema = WDCSchema.generateSchema(json, json.length);

      expect(schema).to.deep.equal([ { name: 'intKey', type: 'int' } ]);
    });

    it('should estimate for float type', function () {
      var json = [ { floatKey: 1.1 }, { floatKey: 2.2 }, { floatKey: 3.3 }, { } ];

      var schema = WDCSchema.generateSchema(json, json.length);

      expect(schema).to.deep.equal([ { name: 'floatKey', type: 'float' } ]);
    });

    it('should estimate for date type', function () {
      var json = [ { dateKey: '2015-06-21' }, { dateKey: 'June 6 2015' }, { } ];

      var schema = WDCSchema.generateSchema(json, json.length);

      expect(schema).to.deep.equal([ { name: 'dateKey', type: 'date' } ]);
    });

    it('should estimate for datetime type', function () {
      var json = [ { datetimeKey: '2015-06-21T02:52:30+0000' }, { datetimeKey: 'Fri Jun 12 2015 12:34:00 GMT-0700' }, { } ];

      var schema = WDCSchema.generateSchema(json, json.length);

      expect(schema).to.deep.equal([ { name: 'datetimeKey', type: 'datetime' } ]);
    });

    it('should estimate for object type', function () {
      var json = [
        { objectKey: { stringKey: 'a', intKey: 1 } },
        { objectKey: { stringKey: 'b', intKey: 2 } },
        { }
      ];

      var schema = WDCSchema.generateSchema(json, json.length);

      expect(schema).to.deep.equal([
        { name: 'objectKey', type: 'object',
          subFields: [
            { name: 'stringKey', type: 'string' },
            { name: 'intKey', type: 'int' }
          ]
        }
      ]);
    });

    // Needed because underscore will treat objects with a "length" field as "array-like"
    it('should work for objects with a "length" key', function() {
      var json = [
        { objectKey: { stringKey: 'a', length: 1 } },
        { objectKey: { stringKey: 'b', length: 2 } },
        { }
      ];

      var schema = WDCSchema.generateSchema(json, json.length);

      expect(schema).to.deep.equal([
        { name: 'objectKey', type: 'object',
          subFields: [
            { name: 'stringKey', type: 'string' },
            { name: 'length', type: 'int' }
          ]
        }
      ]);
    });

    it('should estimate for array type', function () {
      var json = [
        { arrayKey: [ 'a', 'b' ] },
        { arrayKey: [ 'c' ] },
        { arrayKey: [] },
        { }
      ];

      var schema = WDCSchema.generateSchema(json, json.length);

      expect(schema).to.deep.equal([ { name: 'arrayKey', type: 'array', arrayType: 'string' } ]);
    });

    it('should estimate for array type with objects', function () {
      var json = [
        { arrayKey: [ { stringKey: 'a', intKey: 1 }, { stringKey: 'b', intKey: 2 } ] },
        { arrayKey: [ { stringKey: 'c', intKey: 3 } ] },
        { arrayKey: [] },
        { }
      ];

      var schema = WDCSchema.generateSchema(json, json.length);

      expect(schema).to.deep.equal([
        { name: 'arrayKey', type: 'array', arrayType: 'object',
          subFields: [
            { name: 'stringKey', type: 'string' },
            { name: 'intKey', type: 'int' }
          ]
        }
      ]);
    });
    
    describe('mixed estimates', function() {
      /*
      TODO:
      - int/float
      - date/datetime/string
      - incompatible mixed types
       */
    });
  });

})(window);