<div id="page">
	<img
		alt=""
		width="100px"
		height="100px"
		src="https://user-images.githubusercontent.com/13651389/79969148-a9c57280-84c3-11ea-9063-cb8066a12c66.png"
	/>

	<h1>Welcome to Mirrors UI Demo</h1>
	<p>Please open two browser windows,<br />one for each of the following pages:</p>
	<ul>
		<li><a href="/embed/"><code>mirrors.Embed</code> (Streamer)</a></li>
		<li><a href="/app/"><code>mirrors.App</code> (Co-browser)</a></li>
	</ul>
	<p class="hint">Requires Socket.IO relay server on <code>localhost:3100</code></p>
</div>

<style>
	/* center the content */
	#page {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu',
			'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
	}

	li {
		line-height: 1.5em;
		list-style: none;
	}

	/* make the links look nicer */
	a {
		color: #ff3e00;
		text-decoration: none;
	}

	a:hover {
		text-decoration: underline;
	}

	.hint {
		margin-top: 1em;
		color: #999;
		font-size: 13px;
	}
</style>
