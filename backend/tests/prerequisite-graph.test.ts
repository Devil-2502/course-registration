import { PrerequisiteGraph } from '../src/prerequisites/prerequisite-graph';

function buildGraph(): PrerequisiteGraph {
  const graph = new PrerequisiteGraph();
  graph.addPrerequisite('CS201', 'CS101');
  graph.addPrerequisite('CS301', 'CS201');
  return graph;
}

describe('findMissing', () => {
  test('Môn không có tiên quyết thì không thiếu gì', () => {
    expect(buildGraph().findMissing('CS101', [])).toEqual([]);
  });

  test('Báo môn tiên quyết chưa đạt', () => {
    expect(buildGraph().findMissing('CS201', [])).toEqual(['CS101']);
  });

  test('Đã đạt môn tiên quyết thì không thiếu gì', () => {
    expect(buildGraph().findMissing('CS201', ['CS101'])).toEqual([]);
  });

  test('Môn có hai tiên quyết, mới đạt một', () => {
    const graph = buildGraph();
    graph.addPrerequisite('CS301', 'MA101');
    expect(graph.findMissing('CS301', ['CS201'])).toEqual(['MA101']);
  });
});

describe('wouldCreateCycle', () => {
  test('Môn không thể là tiên quyết của chính nó', () => {
    expect(buildGraph().wouldCreateCycle('CS201', 'CS201')).toBe(true);
  });

  test('Phát hiện vòng hai môn', () => {
    expect(buildGraph().wouldCreateCycle('CS101', 'CS201')).toBe(true);
  });

  test('Phát hiện vòng ba môn', () => {
    expect(buildGraph().wouldCreateCycle('CS101', 'CS301')).toBe(true);
  });

  test('Quan hệ hợp lệ thì không báo vòng', () => {
    expect(buildGraph().wouldCreateCycle('CS301', 'CS101')).toBe(false);
  });
});

describe('addPrerequisite', () => {
  test('Từ chối quan hệ tạo vòng lặp', () => {
    const graph = buildGraph();
    expect(() => graph.addPrerequisite('CS101', 'CS301')).toThrow('PREREQUISITE_CYCLE');
    expect(graph.getPrerequisites('CS101')).toEqual([]);
  });
});


describe('quan hệ trùng và gỡ quan hệ', () => {
  test('từ chối quan hệ đã tồn tại', () => {
    const graph = buildGraph();
    expect(() => graph.addPrerequisite('CS201', 'CS101')).toThrow('PREREQUISITE_EXISTS');
  });

  test('gỡ quan hệ đang có', () => {
    const graph = buildGraph();
    expect(graph.removePrerequisite('CS201', 'CS101')).toBe(true);
    expect(graph.getPrerequisites('CS201')).toEqual([]);
  });

  test('gỡ quan hệ không tồn tại thì trả false', () => {
    expect(buildGraph().removePrerequisite('CS201', 'MA101')).toBe(false);
    expect(buildGraph().removePrerequisite('XX999', 'CS101')).toBe(false);
  });

  test('gỡ xong thì quan hệ ngược lại không còn tạo vòng', () => {
    const graph = buildGraph();
    graph.removePrerequisite('CS201', 'CS101');
    expect(graph.wouldCreateCycle('CS101', 'CS201')).toBe(false);
  });
});

describe('đồ thị hình kim cương', () => {
  test('môn được tới từ hai đường chỉ xét một lần và không bị coi là vòng', () => {
    const graph = new PrerequisiteGraph();
    graph.addPrerequisite('CS301', 'CS201');
    graph.addPrerequisite('CS302', 'CS201');
    graph.addPrerequisite('CS401', 'CS301');
    graph.addPrerequisite('CS401', 'CS302');
    expect(graph.wouldCreateCycle('CS501', 'CS401')).toBe(false);
    expect(graph.wouldCreateCycle('CS201', 'CS401')).toBe(true);
  });
});