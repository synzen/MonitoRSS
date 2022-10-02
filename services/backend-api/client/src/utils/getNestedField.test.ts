import { getNestedField } from './getNestedField';

describe('getNestedField', () => {
  it('works', () => {
    expect(getNestedField({ a: { b: { c: 1 } } }, 'a.b.c')).toEqual(1);
  });

  it('returns undefined if field does not exist', () => {
    expect(getNestedField({ a: { b: { c: 1 } } }, 'a.b.d')).toEqual(undefined);
  });

  it('returns undefined if object is undefined', () => {
    expect(getNestedField(undefined as never, 'a.b.d')).toEqual(undefined);
  });

  it('returns undefined if object is null', () => {
    expect(getNestedField(null as never, 'a.b.d')).toEqual(undefined);
  });

  it('returns undefined if object is an array', () => {
    expect(getNestedField([1, 2, 3], 'a.b.d')).toEqual(undefined);
  });
});
