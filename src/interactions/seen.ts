export class SeenIds {
    private readonly order: string[] = [];
    private readonly ids = new Set<string>();

    /** Returns true the first time this id is observed. */
    observe(id: string): boolean {
        if (!id || this.ids.has(id)) return false;
        this.ids.add(id);
        this.order.push(id);
        if (this.order.length > 2000) {
            const oldest = this.order.shift();
            if (oldest) this.ids.delete(oldest);
        }
        return true;
    }
}
