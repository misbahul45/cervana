<script lang="ts">
	import { sidebarItems as items } from '$lib/constants/index';
  import Icon from '@iconify/svelte';
  import { onMount } from 'svelte';
  import { loadIcons } from '@iconify/svelte';
  import type { PageData } from '../../../routes/$types';
  import { goto } from '$app/navigation';



  let expandedItems: Set<number> = $state(new Set());
  const { data }: { data: PageData } = $props();

  onMount(() => {
    const allIcons = [
      ...items.map(i => i.icon).filter(Boolean),
      "lucide:chevron-down",
      "lucide:shield-check",
    ] as string[];
    loadIcons(allIcons);

    items.forEach(item => {
      if (item.children) {
        const hasActiveChild = item.children.some(child => 
          data.pathName === child.href || data.pathName.includes(child.href?.split(':')[0] || '')
        );
        if (hasActiveChild) expandedItems.add(item.id);
      }
    });
  });

  function toggleExpand(itemId: number) {
    const newSet = new Set(expandedItems);
    if (newSet.has(itemId)) newSet.delete(itemId);
    else newSet.add(itemId);
    expandedItems = newSet;
  }

  function isActive(href?: string): boolean {
    if (!href) return false;
    return data.pathName === href;
  }
</script>

<div class={data.pathName !== "/signin" ? 'w-full max-w-64' : ''}>
  {#if data.pathName !== '/signin'}
    <div class="w-full h-screen bg-linear-to-b from-slate-900 via-slate-900 to-slate-950 border-r border-slate-700/50 flex flex-col">
      {#if data?.user?.name}
        <div class="p-6 border-b border-slate-700/50">
          <div class="flex items-center gap-3">
            <img src="{data.user.image?.url}" alt="user-{data.user.id}" class="size-10 rounded-full" />
            <div>
              <p class="text-sm text-foreground/40">Welcome back</p>
              <p class="text-foreground font-semibold text-center">{data.user.name}</p>
            </div>
          </div>
        </div>
      {/if}

      <nav class="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        <ul class="space-y-1">
          {#each items as item}
            <li class="flex flex-col">
              <button
                onclick={() => {
                  if (!item.children && item.href) goto(item.href);
                  else toggleExpand(item.id);
                }}
                class="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
                  {isActive(item.href) 
                    ? 'bg-linear-to-r bg-primary/70 text-white shadow-lg shadow-blue-primary/20' 
                    : 'text-gray-300 hover:bg-primary/20 hover:text-white'}"
              >
                <div class="flex items-center gap-3">
                  {#if item.icon}
                    <Icon 
                      icon={item.icon} 
                      class="w-5 h-5 transition-transform duration-200 {isActive(item.href) ? 'scale-110' : 'group-hover:scale-110'}" 
                    />
                  {/if}
                  <span class="text-sm font-medium">{item.label}</span>
                </div>

                {#if item.children}
                  <Icon 
                    icon="lucide:chevron-down" 
                    class="w-4 h-4 transition-transform duration-200 {expandedItems.has(item.id) ? 'rotate-180' : ''}" 
                  />
                {/if}
              </button>

              {#if item.children && expandedItems.has(item.id)}
                <ul class="ml-4 mt-1 space-y-1 border-l-2 border-slate-700/50 pl-4 animate-in slide-in-from-top-2 duration-200">
                  {#each item.children as child}
                    <li>
                      <a
                        href={child.href}
                        class="block px-4 py-2 text-sm rounded-lg transition-all duration-200
                          {isActive(child.href)
                            ? 'text-secondary/80 bg-secondary/10 font-medium border-l-2 border-secondary/90 -ml-0.5 pl-3.5'
                            : 'text-gray-400 hover:text-white hover:bg-slate-800/30'}"
                      >
                        <span class="flex items-center gap-2">
                          {#if child.icon}
                            <Icon 
                              icon={child.icon} 
                              class="w-5 h-5 transition-transform duration-200 {isActive(item.href) ? 'scale-110' : 'group-hover:scale-110'}" 
                            />
                            {/if}
                          {child.label}
                        </span>
                      </a>
                    </li>
                  {/each}
                </ul>
              {/if}
            </li>
          {/each}
        </ul>
      </nav>

      <div class="p-4 border-t border-slate-700/50">
        <div class="flex items-center gap-2 px-4 py-2 text-xs text-gray-500">
          <Icon icon="lucide:shield-check" class="w-4 h-4" />
          <span>Teacher Portal v1.0</span>
        </div>
      </div>
    </div>
  {/if}
</div>
