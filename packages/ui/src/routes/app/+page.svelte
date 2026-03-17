<script lang="typescript">
	import * as syncit from '$lib/index';
	import * as syncitTransporter from '@syncit/transporter';

	new syncit.App({
		target: document.body,
		props: {
			bufferMs: 100,
			createTransporter({ uid }) {
				return new syncitTransporter.PeerjsTransporter({
					uid,
					role: 'app',
					peerHost: 'localhost',
					peerPort: 9000,
					peerPath: '/syncit',
				});
			}
		}
	});
</script>
