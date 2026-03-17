<script lang="typescript">
	import * as mirrors from '$lib/index';
	import * as mirrorsTransporter from '@mirrors/transporter';

	new mirrors.App({
		target: document.body,
		props: {
			bufferMs: 100,
			createTransporter({ uid }) {
				return new mirrorsTransporter.SocketIoTransporter({
					uid,
					role: 'app',
					url: 'http://localhost:3100',
				});
			}
		}
	});
</script>
