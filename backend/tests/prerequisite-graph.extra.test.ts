import { PrerequisiteGraph } from '../src/prerequisites/prerequisite-graph';

// Unit test bổ sung cho đồ thị tiên quyết (M4): đồ thị lớn, chuỗi dài, nhiều nhánh.

function buildChain(length: number): PrerequisiteGraph {
  // C1 <- C2 <- C3 ... : môn Ck cần môn C(k-1)
  const graph = new PrerequisiteGraph();
  for (let k = 2; k <= length; k += 1) {
    graph.addPrerequisite(`C${k}`, `C${k - 1}`);
  }
  return graph;
}

describe('PrerequisiteGraph - đồ thị lớn', () => {
  it('Chuỗi 500 môn: nối môn đầu vào môn cuối thì tạo vòng', () => {
    const graph = buildChain(500);
    expect(graph.wouldCreateCycle('C1', 'C500')).toBe(true);
  });

  it('Chuỗi 500 môn: thêm cạnh cùng chiều thì không tạo vòng', () => {
    const graph = buildChain(500);
    expect(graph.wouldCreateCycle('C500', 'C1')).toBe(false);
  });

  it('Kiểm tra vòng trên chuỗi 2000 môn chạy dưới 1 giây', () => {
    const graph = buildChain(2000);
    const started = Date.now();
    expect(graph.wouldCreateCycle('C1', 'C2000')).toBe(true);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('Môn có nhiều tiên quyết: chỉ báo các môn còn thiếu', () => {
    const graph = new PrerequisiteGraph();
    ['A', 'B', 'C', 'D'].forEach((p) => graph.addPrerequisite('X', p));
    expect(graph.findMissing('X', new Set(['A', 'C'])).sort()).toEqual(['B', 'D']);
  });

  it('Chỉ xét tiên quyết trực tiếp, không đòi tiên quyết gián tiếp', () => {
    const graph = buildChain(3); // C3 cần C2, C2 cần C1
    expect(graph.findMissing('C3', ['C2'])).toEqual([]);
  });

  it('Nhiều nhánh hội tụ không bị coi là vòng', () => {
    const graph = new PrerequisiteGraph();
    graph.addPrerequisite('TOP', 'L');
    graph.addPrerequisite('TOP', 'R');
    graph.addPrerequisite('L', 'BASE');
    graph.addPrerequisite('R', 'BASE');
    expect(graph.wouldCreateCycle('TOP', 'BASE')).toBe(false);
    expect(graph.wouldCreateCycle('BASE', 'TOP')).toBe(true);
  });

  it('Gỡ một cạnh giữa chuỗi thì cạnh ngược lại không còn tạo vòng', () => {
    const graph = buildChain(10);
    expect(graph.wouldCreateCycle('C1', 'C10')).toBe(true);
    graph.removePrerequisite('C6', 'C5');
    expect(graph.wouldCreateCycle('C1', 'C10')).toBe(false);
  });
});
