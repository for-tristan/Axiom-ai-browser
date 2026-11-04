import 'package:flutter/material.dart';

import 'axiom_page_shell.dart';
import 'browser_store.dart';
import 'theme.dart';

/// كل الصفحات اللي اليوزر حفظها بالنجمة، حتى لو قفل التاب بتاعها.
/// الضغط على عنصر بيرجع الرابط لصفحة المتصفح وهي بتفتحه في تاب جديد.
class BookmarksPage extends StatefulWidget {
  const BookmarksPage({super.key});

  @override
  State<BookmarksPage> createState() => _BookmarksPageState();
}

class _BookmarksPageState extends State<BookmarksPage> {
  final BrowserStore _store = BrowserStore.instance;

  @override
  void initState() {
    super.initState();
    _store.init();
  }

  Widget _entryCard(BookmarkEntry entry) {
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
                  '${displayHost(entry.url)} · Saved ${dayLabel(entry.savedAt).toLowerCase()}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12, color: AxiomColors.textMuted),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Remove from saved',
            onPressed: () => _store.removeBookmark(entry),
            icon: Icon(
              Icons.delete_outline,
              size: 20,
              color: AxiomColors.textMuted,
            ),
          ),
        ],
      ),
    );
  }

  Widget _body() {
    final List<BookmarkEntry> entries = _store.bookmarks;

    if (entries.isEmpty) {
      return const AxiomEmptyState(
        icon: Icons.bookmark_border,
        title: 'No saved pages yet',
        message: 'Tap the star in the address bar to save a page.',
      );
    }

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 760),
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [for (final entry in entries) _entryCard(entry)],
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
          title: 'Bookmarks',
          icon: Icons.bookmark,
          child: _body(),
        );
      },
    );
  }
}
