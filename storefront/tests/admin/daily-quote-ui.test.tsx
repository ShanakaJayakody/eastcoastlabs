// @vitest-environment jsdom
import React from 'react';
import {render,screen,act,cleanup} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import DailyQuote from '@/components/admin/overview/DailyQuote';
import {dailyQuote} from '@/lib/admin/daily-quote';
afterEach(()=>{cleanup();vi.useRealTimers();});
it('hydrates with its seed, rotates, and cleans up its timer',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-30T13:59:59Z'));
  const initial=dailyQuote(new Date());
  const view=render(<DailyQuote initial={initial}/>);
  expect(screen.getByText(initial.text)).toBeTruthy();
  act(()=>{vi.advanceTimersByTime(1001)});
  expect(screen.queryByText(initial.text)).toBeNull();
  expect(screen.getByText(dailyQuote(new Date()).text)).toBeTruthy();
  view.unmount();expect(vi.getTimerCount()).toBe(0);
});
