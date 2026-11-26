import PageProfile from '.'

export default PageProfile

// [local patch] The static export builds only the '_' page and the Cloudflare
// Worker serves it for every id. `next dev` has no Worker, so render on request there.
export async function getStaticPaths() {
  return {
    paths: [{ params: { account: '_' } }],
    fallback: process.env.NODE_ENV === 'development' ? 'blocking' : false
  }
}

export async function getStaticProps() {
  return { props: {} }
}
