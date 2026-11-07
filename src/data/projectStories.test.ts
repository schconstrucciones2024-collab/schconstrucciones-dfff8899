import { describe, expect, it } from 'vitest';
import { PROJECT_STORIES, projectPaths } from './projectStories';
import { PROJECTS } from './projects';
describe('Portfolio real con URLs', () => {
  it('preserva las doce obras y sus galerías sin añadir proyectos', () => {
    expect(PROJECT_STORIES).toHaveLength(12);
    expect(PROJECT_STORIES.map(p => p.name)).toEqual(PROJECTS.map(p => p.name));
    expect(PROJECT_STORIES.map(p => p.images)).toEqual(PROJECTS.map(p => p.images));
  });
  it('genera una URL única para cada obra sin inventar fechas', () => {
    expect(new Set(projectPaths().map(p => p.path)).size).toBe(12);
    expect(projectPaths()).toContainEqual({ path: '/proyectos/lo-de-cata' });
    expect(PROJECT_STORIES.find(p => p.slug === 'la-diosa')?.year).toBe('2019-20');
  });
});