<script lang="ts">
    let { minWidth, gap, className, children }:{
        minWidth:string;
        gap:string;
        className?:string;
        children:any
    }=$props()
</script>


<div class={`grid gap-${gap} ${className}`} style={`grid-template-columns: repeat(auto-fit, minmax(${minWidth}, 1fr));`}>
    {@render children()}
</div>