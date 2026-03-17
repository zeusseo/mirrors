<script lang="typescript">
	import * as syncit from '$lib/index';
	import * as syncitTransporter from '@syncit/transporter';

	new syncit.App({
		target: document.body,
		props: {
			bufferMs: 100,
			createTransporter({ uid }) {
				return new syncitTransporter.SocketIoTransporter({
					uid,
					role: 'app',
					url: 'http://localhost:3100',
				});
			}
		}
	});
</script>
