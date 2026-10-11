// Đồ thị môn tiên quyết: Mỗi môn trỏ tới danh sách môn phải đạt trước.
export class PrerequisiteGraph {
    private readonly edges = new Map<string, Set<string>>();

    //Các môn tiên quyết trực tiếp của một môn.
    getPrerequisites(course: string): string[] {
        return [...(this.edges.get(course) ?? [])];
    }

    // Các môn tiên quyết mà sinh viên chưa đạt.
    findMissing(course: string, passedCourses: Iterable<string>): string[] {
        const passed = new Set(passedCourses);
        return this.getPrerequisites(course).filter((p) => !passed.has(p));
    }

    // Thêm quan hệ "course cần prerequisite" có tạo vòng lặp không?
    // Có vòng khi từ prerequisite đi theo các cạnh mà tới được course.
    wouldCreateCycle(course: string, prerequisite: string): boolean {
        if (course === prerequisite) return true;
        const visited = new Set<string>();
        const stack = [prerequisite];
        while (stack.length > 0) {
        const current = stack.pop()!;
        if (current === course) return true;
        if (visited.has(current)) continue;
        visited.add(current);
        stack.push(...this.getPrerequisites(current));
        }
        return false;
    }

    // Thêm quan hệ; từ chối nếu tạo vòng lặp hoặc đã tồn tại.
    addPrerequisite(course: string, prerequisite: string): void {
        if (this.wouldCreateCycle(course, prerequisite)) {
        throw new Error('PREREQUISITE_CYCLE');
        }
        if (this.edges.get(course)?.has(prerequisite)) {
        throw new Error('PREREQUISITE_EXISTS');
        }
        if (!this.edges.has(course)) this.edges.set(course, new Set());
        this.edges.get(course)!.add(prerequisite);
    }

    // Gỡ quan hệ; trả về true nếu quan hệ có tồn tại và đã gỡ.
    removePrerequisite(course: string, prerequisite: string): boolean {
        return this.edges.get(course)?.delete(prerequisite) ?? false;
    }
}