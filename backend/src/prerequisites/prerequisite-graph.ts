// Đồ thị môn tiên quyết: mỗi môn trỏ tới danh sách môn phải đạt trước.
export class PrerequisiteGraph {
  private readonly edges = new Map<string, Set<string>>();

  // Các môn tiên quyết trực tiếp của một môn.
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
    // pop() trả undefined khi ngăn xếp rỗng, nên vòng lặp tự dừng mà không cần dấu "!"
    let current = stack.pop();
    while (current !== undefined) {
      if (current === course) return true;
      if (!visited.has(current)) {
        visited.add(current);
        stack.push(...this.getPrerequisites(current));
      }
      current = stack.pop();
    }
    return false;
  }

  // Thêm quan hệ; từ chối nếu tạo vòng lặp hoặc đã tồn tại.
  addPrerequisite(course: string, prerequisite: string): void {
    if (this.wouldCreateCycle(course, prerequisite)) {
      throw new Error('PREREQUISITE_CYCLE');
    }
    const prerequisites = this.edges.get(course) ?? new Set<string>();
    if (prerequisites.has(prerequisite)) {
      throw new Error('PREREQUISITE_EXISTS');
    }
    prerequisites.add(prerequisite);
    this.edges.set(course, prerequisites);
  }

  // Gỡ quan hệ; trả về true nếu quan hệ có tồn tại và đã gỡ.
  removePrerequisite(course: string, prerequisite: string): boolean {
    return this.edges.get(course)?.delete(prerequisite) ?? false;
  }
}