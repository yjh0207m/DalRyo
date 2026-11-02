// 화면 위에 밀려 들어와 있는 화면(SlideScreen)들의 목록. 가장자리 스와이프가 맨 위 화면을 손가락에 따라 움직이게 한다.
// 화면 컴포넌트와 제스처 컴포넌트가 서로를 직접 알지 않도록 별도 모듈로 둔다

export type SlideEntry = {
  // 손가락이 오른쪽으로 dx만큼 움직였다
  drag: (dx: number) => void;
  // 손가락을 뗐다. commit이면 뒤로 가려고 시도하고, 화면이 닫히지 않으면(확인 창 등) 제자리로 돌아온다
  release: (commit: boolean) => void;
};

const entries: SlideEntry[] = [];

export function registerSlide(entry: SlideEntry) {
  entries.push(entry);
  return () => {
    const index = entries.lastIndexOf(entry);
    if (index >= 0) entries.splice(index, 1);
  };
}

// 가장 나중에 올라온(맨 위) 화면. 없으면 null
export function topSlide(): SlideEntry | null {
  return entries[entries.length - 1] ?? null;
}

// 테스트에서 비울 때 쓴다
export function resetSlides() {
  entries.length = 0;
}
