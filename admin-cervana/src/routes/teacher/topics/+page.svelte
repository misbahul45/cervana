<script lang="ts">
  import Grid from "$lib/components/ui/Grid.svelte";
  import type { Topic } from "$lib/types/topic.type";
  import Icon from "@iconify/svelte";

  let q = $state('');
  let sortCriteria = $state<{ id: number; name: string; key: keyof Topic; dir: 'asc' | 'desc', icon:string }[]>([]);
  let showSort = $state(false);
  let topics=$state<Topic[]>([])
  let { data }=$props()


  $inspect(data)

  const sortOptions = [
    { id: 1, name: "Title", key: "title", icon: "lucide:heading" },
    { id: 2, name: "Price", key: "price", icon: "lucide:coins" },
    { id: 3, name: "Created Date", key: "createdAt", icon: "lucide:calendar-days" },
  ] as const;

  const addSortCriteria = (opt: typeof sortOptions[number]) => {
    const existing = sortCriteria.find((s) => s.key === opt.key);
    if (existing) {
      existing.dir = existing.dir === "asc" ? "desc" : "asc";
    } else {
      sortCriteria.push({ ...opt, dir: "asc" });
    }
    showSort = false;
  };

  const removeSortCriteria = (id: number) => {
    sortCriteria = sortCriteria.filter((s) => s.id !== id);
  };




</script>

<div>
  <h1 class="lg:text-3xl 2xl:text-4xl md:text-2xl sm:text-xl text-lg font-semibold">
    Manage Your Courses
  </h1>

  <div class="w-full flex gap-4 items-center mb-8 mt-6">
    <div class="relative w-full max-w-md">
      <input
        type="text"
        bind:value={q}
        placeholder="Cari class..."
        class="w-full rounded-md bg-background/20 pl-10 pr-3 py-2 outline-none ring ring-gray-200"
      />
      <Icon
        icon="lucide:search"
        class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
      />
    </div>

    <div class="flex-1 relative w-full">
      {#if sortCriteria.length > 0}
          <div class="absolute bottom-full mb-2 w-full flex flex-end flex-wrap gap-1.5">
            {#each sortCriteria as sort}
              <div class="flex items-center gap-1 bg-primary/10 px-2 py-1.5 rounded text-xs">
                <span class="font-semibold">{sort.name} ({sort.dir})</span>
                <button
                  onclick={() => removeSortCriteria(sort.id)}
                  class="text-gray-500 hover:text-red-500"
                >
                  <Icon icon="lucide:x" width="14" />
                </button>
              </div>
            {/each}
          </div>
        {/if}

      <button
        onclick={() => (showSort = !showSort)}
        class="flex ml-auto items-center gap-2 px-4 py-2 font-semibold text-sm rounded-sm bg-primary/20 ring-2 ring-primary/30 cursor-pointer"
      >
        <Icon icon="ic:baseline-sort-by-alpha" class="size-5" />
        Sort by
      </button>
      {#if showSort}
        <div
          class="absolute top-full right-0 w-48 bg-background/60 border border-secondary backdrop-blur-lg shadow-md rounded-md mt-1 z-10"
        >
          {#each sortOptions as opt}
            <button
              class="flex w-full items-center justify-between px-3 py-2 hover:bg-secondary/40 cursor-pointer text-sm"
              onclick={() => addSortCriteria(opt)}
            >
              <div class="flex items-center gap-2">
                <Icon icon={opt.icon} width="16" />
                <span>{opt.name}</span>
              </div>
              {#if sortCriteria.find((s) => s.id === opt.id)}
                <Icon icon="lucide:check" width="14" class="text-primary" />
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <Grid minWidth="250px" gap="4">
    {#each topics as topic}
      <div class="bg-red-500 text-yellow-300 p-4 rounded text-center">
        <img
          src={topic.image.url}
          alt={topic.title}
          class="w-full h-32 object-cover rounded mb-2"
        />
        <h2 class="font-bold">{topic.title}</h2>
        <p class="text-sm">{topic.description}</p>
        {#if topic.isFree}
          <span class="text-green-500 font-semibold">Free</span>
        {:else}
          <span class="text-gray-700 font-semibold">${topic.price}</span>
        {/if}
      </div>
    {/each}
  </Grid>
</div>
