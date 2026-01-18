import { supabaseAdmin } from '@/lib/supabase/admin';
import { Account } from '@/types';

export async function fetchActiveAccounts(): Promise<Account[]> {
  const { data, error } = await supabaseAdmin
    .from('accounts')
    .select('*')
    .eq('is_active', true)
    .in('type', ['checking', 'savings', 'credit_card', 'loan'])
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('[accounts] Failed to fetch accounts', error);
    return [];
  }

  const accounts = data || [];

  for (const account of accounts) {
    const { data: transactions, error: transactionsError } = await supabaseAdmin
      .from('transactions')
      .select('amount')
      .eq('account_id', account.id);

    if (transactionsError) {
      console.error('[accounts] Failed to fetch account balance', transactionsError);
      account.current_balance = account.current_balance ?? 0;
      continue;
    }

    account.current_balance =
      transactions?.reduce((sum, transaction) => sum + (transaction.amount ?? 0), 0) || 0;
  }

  return accounts;
}

export async function ensureDefaultAccount(): Promise<Account | null> {
  const accounts = await fetchActiveAccounts();
  if (accounts.length > 0) {
    return accounts[0];
  }

  const { data, error } = await supabaseAdmin
    .from('accounts')
    .insert({
      name: 'Default Account',
      type: 'checking',
      institution: 'Unknown',
      is_active: true,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[accounts] Failed to create default account', error);
    return null;
  }

  return data;
}

export async function resolveAccountSelection(accountId?: string) {
  let accounts = await fetchActiveAccounts();
  let selected = accountId ? accounts.find((account) => account.id === accountId) : null;
  let createdDefault = false;

  if (!selected) {
    if (accounts.length === 0) {
      const defaultAccount = await ensureDefaultAccount();
      if (defaultAccount) {
        accounts = [defaultAccount];
        selected = defaultAccount;
        createdDefault = true;
      }
    } else {
      selected = accounts[0];
    }
  }

  return {
    accounts,
    selectedAccount: selected ?? null,
    createdDefault,
    needsRedirect: Boolean(selected && selected.id !== accountId),
  };
}
