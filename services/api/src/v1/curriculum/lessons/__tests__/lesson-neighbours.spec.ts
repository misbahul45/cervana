import { neighboursOf } from '../lesson-neighbours';

const lessons = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('neighboursOf', () => {
  it('returns both neighbours for a lesson in the middle', () => {
    expect(neighboursOf(lessons, 'b')).toEqual({ previous: { id: 'a' }, next: { id: 'c' } });
  });

  it('has no previous lesson for the first and no next lesson for the last', () => {
    expect(neighboursOf(lessons, 'a')).toEqual({ previous: null, next: { id: 'b' } });
    expect(neighboursOf(lessons, 'c')).toEqual({ previous: { id: 'b' }, next: null });
  });

  it('has no neighbours for the only lesson of a sub-topic', () => {
    expect(neighboursOf([{ id: 'only' }], 'only')).toEqual({ previous: null, next: null });
  });

  it('is null for a lesson that is not in the list', () => {
    expect(neighboursOf(lessons, 'zzz')).toBeNull();
    expect(neighboursOf([], 'a')).toBeNull();
  });
});
