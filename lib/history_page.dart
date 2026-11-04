import 'package:flutter/material.dart';

import 'axiom_page_shell.dart';
import 'browser_store.dart';
import 'theme.dart';

/// كل المواقع والبحث اللي اليوزر دخل عليه. الضغط على عنصر بيرجع الرابط
/// لصفحة المتصفح وهي بتفتحه في تاب جديد.
class HistoryPage extends StatefulWidget {
  const HistoryPage({super.key});

  @override
  State<HistoryPage> createState() => _HistoryPageState();
}

class _HistoryPageState extends State<HistoryPage> {
  final BrowserStore _store = BrowserStore.instance;
  final TextEditingController _filterController = TextEditingController();
  String _filter = '';

  @override
  void initState() {
    super.initState();
    _store.init();
  }

  @override
  void dispose() {
    _filterController.dispose();
    super.dispose();
  }

  Future<void> _confirmClear() async {
    final bool? ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AxiomColors.bgBottom,
        title: const Text('Clear history?'),
        content: const Text('All visited pages will be removed.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text(
              'Clear',
              style: TextStyle(color: AxiomColors.danger),
            ),
          ),
        ],
      ),
    );
    if (ok == true) {
      await _store.clearHistory();
    }
  }

  Widget _filterField() {
    return Container(
      height: 42,
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: AxiomColors.surface,
        borderRadius: BorderRadius.circular(21),
        border: Border.all(color: AxiomColors.border),
      ),
      child: Row(
        children: [
          Icon(Icons.search, size: 18, color: AxiomColors.textMuted),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: _filterController,
              onChanged: (value) => setState(() => _filter = value),
              style: const TextStyle(fontSize: 14),
              cursorColor: AxiomColors.accent,
              decoration: InputDecoration(
                border: InputBorder.none,
                isDense: true,
                hintText: 'Search history',
                hintStyle: TextStyle(color: AxiomColors.textMuted),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionTitle(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, left: 2, top: 4),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 13,
          letterSpacing: 0.5,
          color: AxiomColors.textMuted,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _entryCard(HistoryEntry entry) {
    return AxiomCard(
      onTap: () => Navigator.of(context).pop(entry.url),
      padding: const EdgeInsets.fromLTRB(14, 10, 6, 10),
      child: Row(
        children: [
          SiteBadge(title: entry.title, url: entry.url),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${displayHost(entry.url)} · ${formatTime(entry.visitedAt)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12, color: AxiomColors.textMuted),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Remove',
            onPressed: () => _store.removeHistory(entry),
            icon: Icon(Icons.close, size: 18, color: AxiomColors.textMuted),
          ),
        ],
      ),
    );
  }

  Widget _body() {
    final String query = _filter.trim().toLowerCase();
    final List<HistoryEntry> all = _store.history;

    if (all.isEmpty) {
      return const AxiomEmptyState(
        icon: Icons.history,
        title: 'No history yet',
        message: 'Pages you visit and search for will show up here.',
      );
    }

    final List<HistoryEntry> entries = all
        .where(
          (e) =>
              query.isEmpty ||
              e.title.toLowerCase().contains(query) ||
              e.url.toLowerCase().contains(query),
        )
        .toList();

    final List<Widget> children = [_filterField()];

    if (entries.isEmpty) {
      children.add(
        Padding(
          padding: const EdgeInsets.only(top: 24),
          child: Center(
            child: Text(
              'No matches',
              style: TextStyle(color: AxiomColors.textMuted),
            ),
          ),
        ),
      );
    }

    String? lastLabel;
    for (final entry in entries) {
      final label = dayLabel(entry.visitedAt);
      if (label != lastLabel) {
        children.add(_sectionTitle(label));
        lastLabel = label;
      }
      children.add(_entryCard(entry));
    }

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 760),
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: children,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _store,
      builder: (context, _) {
        return AxiomPageShell(
          title: 'History',
          icon: Icons.history,
          actions: [
            IconButton(
              tooltip: 'Clear history',
              onPressed: _store.history.isEmpty ? null : _confirmClear,
              icon: const Icon(Icons.delete_sweep_outlined, size: 20),
            ),
          ],
          child: _body(),
        );
      },
    );
  }
}
