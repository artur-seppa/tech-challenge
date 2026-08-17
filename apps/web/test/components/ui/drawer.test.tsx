import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Drawer } from '../../../src/components/ui/drawer';

describe('Drawer', () => {
  it('renders nothing when closed', () => {
    render(
      <Drawer open={false} onClose={vi.fn()} title="Detalhe">
        <p>conteúdo</p>
      </Drawer>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders a labelled dialog with its children when open', () => {
    render(
      <Drawer open onClose={vi.fn()} title="Detalhe">
        <p>conteúdo</p>
      </Drawer>,
    );

    expect(screen.getByRole('dialog', { name: 'Detalhe' })).toBeInTheDocument();
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Drawer open onClose={onClose} title="Detalhe">
        <p>conteúdo</p>
      </Drawer>,
    );

    await user.click(screen.getByRole('button', { name: /fechar/i }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Drawer open onClose={onClose} title="Detalhe">
        <p>conteúdo</p>
      </Drawer>,
    );

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the backdrop is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <Drawer open onClose={onClose} title="Detalhe">
        <p>conteúdo</p>
      </Drawer>,
    );

    const backdrop = container.querySelector('[aria-hidden="true"]');
    if (!backdrop) throw new Error('backdrop not found');
    await user.click(backdrop);

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('moves focus into the dialog when it opens', () => {
    render(
      <Drawer open onClose={vi.fn()} title="Detalhe">
        <p>conteúdo</p>
      </Drawer>,
    );

    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('moves focus to the last focusable element on Shift+Tab from the container itself', async () => {
    const user = userEvent.setup();
    render(
      <Drawer open onClose={vi.fn()} title="Detalhe">
        <button type="button">Ação</button>
      </Drawer>,
    );

    // Right after opening, focus sits on the dialog container itself (per the "moves focus
    // into the dialog when it opens" test above), deliberately excluded from the focusable
    // NodeList by its tabIndex={-1}.
    expect(screen.getByRole('dialog')).toHaveFocus();

    await user.tab({ shift: true });

    const focusable = screen.getAllByRole('button');
    const last = focusable[focusable.length - 1]!;
    expect(last).toHaveFocus();
  });
});
