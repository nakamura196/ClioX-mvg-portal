import PageProfile from '.'

export default PageProfile

export async function getStaticPaths() {
  return { paths: [{ params: { account: '_' } }], fallback: false }
}

export async function getStaticProps() {
  return { props: {} }
}
