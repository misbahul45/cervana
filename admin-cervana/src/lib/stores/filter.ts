import { writable } from 'svelte/store';
import type { Query } from '$lib/types/api.type';

function createFilterPagination() {
	const initialState: Query = {
		q: '',
		page: 1,
		limit: 10,
		sort: '',
		include: undefined
	};

	const { subscribe, set, update } = writable<Query>(initialState);

	return {
		subscribe,
		set: (newState: Query) => set({ ...initialState, ...newState }),
		updateFilter: (changes: Partial<Query>) =>
			update((state) => ({
				...state,
				...changes
			})),
		reset: () => set(initialState)
	};
}

export const filterPagination = createFilterPagination();
